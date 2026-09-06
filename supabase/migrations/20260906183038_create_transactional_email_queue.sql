create table private.transactional_email_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_id uuid references public.creator_portfolios(id) on delete cascade,
  event_type text not null,
  deduplication_key text not null unique,
  recipient_email text not null,
  creator_name text not null default 'creadora',
  portfolio_slug text,
  status text not null default 'pending',
  attempt_count smallint not null default 0,
  next_attempt_at timestamptz,
  provider_message_id text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  constraint transactional_email_deliveries_event_type_check check (
    event_type in ('welcome', 'published')
  ),
  constraint transactional_email_deliveries_payload_check check (
    (
      event_type = 'welcome'
      and portfolio_id is null
      and portfolio_slug is null
    )
    or (
      event_type = 'published'
      and portfolio_id is not null
      and portfolio_slug is not null
      and char_length(portfolio_slug) between 3 and 80
    )
  ),
  constraint transactional_email_deliveries_recipient_check check (
    char_length(recipient_email) between 3 and 320
  ),
  constraint transactional_email_deliveries_status_check check (
    status in ('pending', 'processing', 'sent', 'failed')
  ),
  constraint transactional_email_deliveries_attempt_count_check check (
    attempt_count between 0 and 3
  )
);

comment on table private.transactional_email_deliveries is
  'Idempotent queue for Brilla welcome and first-publication emails. Stores only the authorized recipient email, visible name, and public slug required for delivery.';

create index transactional_email_deliveries_claim_idx
on private.transactional_email_deliveries (next_attempt_at, created_at)
where status in ('pending', 'failed') and attempt_count < 3;

create index transactional_email_deliveries_stuck_idx
on private.transactional_email_deliveries (updated_at)
where status = 'processing' and attempt_count < 3;

alter table private.transactional_email_deliveries enable row level security;
revoke all on table private.transactional_email_deliveries from public, anon, authenticated;

create policy "Transactional email deliveries cannot be read directly"
on private.transactional_email_deliveries
for select
to anon, authenticated
using (false);

create policy "Transactional email deliveries cannot be inserted directly"
on private.transactional_email_deliveries
for insert
to anon, authenticated
with check (false);

create policy "Transactional email deliveries cannot be updated directly"
on private.transactional_email_deliveries
for update
to anon, authenticated
using (false)
with check (false);

create policy "Transactional email deliveries cannot be deleted directly"
on private.transactional_email_deliveries
for delete
to anon, authenticated
using (false);

create trigger transactional_email_deliveries_set_updated_at
before update on private.transactional_email_deliveries
for each row execute function private.set_creator_portfolio_updated_at();

create or replace function private.queue_welcome_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient_name text;
begin
  if coalesce(new.email, '') = '' then
    return new;
  end if;

  recipient_name := left(
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      nullif(split_part(new.email, '@', 1), ''),
      'creadora'
    ),
    100
  );

  insert into private.transactional_email_deliveries (
    user_id,
    event_type,
    deduplication_key,
    recipient_email,
    creator_name,
    next_attempt_at
  )
  values (
    new.id,
    'welcome',
    'welcome:' || new.id::text,
    new.email,
    recipient_name,
    now()
  )
  on conflict (deduplication_key) do nothing;

  return new;
end;
$$;

create or replace function private.queue_publication_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient_email text;
  recipient_name text;
begin
  if new.status <> 'published' or new.slug is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status = 'published' then
    return new;
  end if;

  select
    coalesce(nullif(profile.email, ''), nullif(auth_user.email, '')),
    left(
      coalesce(
        nullif(profile.display_name, ''),
        nullif(new.content ->> 'name', ''),
        nullif(auth_user.raw_user_meta_data ->> 'full_name', ''),
        nullif(auth_user.raw_user_meta_data ->> 'name', ''),
        nullif(split_part(coalesce(auth_user.email, ''), '@', 1), ''),
        'creadora'
      ),
      100
    )
  into recipient_email, recipient_name
  from auth.users as auth_user
  left join public.creator_profiles as profile
    on profile.id = auth_user.id
  where auth_user.id = new.user_id;

  if recipient_email is null then
    return new;
  end if;

  insert into private.transactional_email_deliveries (
    user_id,
    portfolio_id,
    event_type,
    deduplication_key,
    recipient_email,
    creator_name,
    portfolio_slug,
    next_attempt_at
  )
  values (
    new.user_id,
    new.id,
    'published',
    'published:' || new.id::text,
    recipient_email,
    recipient_name,
    new.slug,
    now()
  )
  on conflict (deduplication_key) do nothing;

  return new;
end;
$$;

revoke all on function private.queue_welcome_email()
from public, anon, authenticated;
revoke all on function private.queue_publication_email()
from public, anon, authenticated;

create trigger queue_brilla_welcome_email_after_signup
after insert on auth.users
for each row execute function private.queue_welcome_email();

create trigger queue_brilla_publication_email_after_insert
after insert on public.creator_portfolios
for each row
when (new.status = 'published')
execute function private.queue_publication_email();

create trigger queue_brilla_publication_email_after_update
after update of status on public.creator_portfolios
for each row
when (new.status = 'published' and old.status is distinct from new.status)
execute function private.queue_publication_email();

create or replace function private.claim_transactional_emails_data(
  requested_batch_size integer default 25
)
returns table (
  delivery_id uuid,
  event_type text,
  recipient_email text,
  creator_name text,
  portfolio_slug text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  return query
  with claimable as (
    select delivery.id
    from private.transactional_email_deliveries as delivery
    where delivery.attempt_count < 3
      and (
        (
          delivery.status in ('pending', 'failed')
          and coalesce(delivery.next_attempt_at, now()) <= now()
        )
        or (
          delivery.status = 'processing'
          and delivery.updated_at <= now() - interval '15 minutes'
        )
      )
    order by delivery.created_at
    for update skip locked
    limit greatest(1, least(coalesce(requested_batch_size, 25), 50))
  ),
  claimed as (
    update private.transactional_email_deliveries as delivery
    set
      status = 'processing',
      attempt_count = delivery.attempt_count + 1,
      next_attempt_at = null,
      last_error = null
    from claimable
    where delivery.id = claimable.id
    returning delivery.*
  )
  select
    claimed.id,
    claimed.event_type,
    claimed.recipient_email,
    claimed.creator_name,
    claimed.portfolio_slug
  from claimed
  order by claimed.created_at;
end;
$$;

create or replace function public.claim_transactional_emails(
  requested_batch_size integer default 25
)
returns table (
  delivery_id uuid,
  event_type text,
  recipient_email text,
  creator_name text,
  portfolio_slug text
)
language sql
volatile
security invoker
set search_path = ''
as $$
  select * from private.claim_transactional_emails_data(requested_batch_size);
$$;

create or replace function private.complete_transactional_email_data(
  requested_delivery_id uuid,
  delivered boolean,
  requested_provider_message_id text default null,
  requested_error text default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  delivery_attempts smallint;
begin
  select delivery.attempt_count
  into delivery_attempts
  from private.transactional_email_deliveries as delivery
  where delivery.id = requested_delivery_id
    and delivery.status = 'processing'
  for update;

  if delivery_attempts is null then
    return false;
  end if;

  if delivered then
    update private.transactional_email_deliveries as delivery
    set
      status = 'sent',
      provider_message_id = left(coalesce(requested_provider_message_id, ''), 255),
      last_error = null,
      next_attempt_at = null,
      sent_at = now()
    where delivery.id = requested_delivery_id;
  else
    update private.transactional_email_deliveries as delivery
    set
      status = 'failed',
      last_error = left(coalesce(requested_error, 'Error desconocido'), 1000),
      next_attempt_at = case
        when delivery_attempts >= 3 then null
        when delivery_attempts = 2 then now() + interval '1 hour'
        else now() + interval '5 minutes'
      end
    where delivery.id = requested_delivery_id;
  end if;

  return true;
end;
$$;

create or replace function public.complete_transactional_email(
  requested_delivery_id uuid,
  delivered boolean,
  requested_provider_message_id text default null,
  requested_error text default null
)
returns boolean
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.complete_transactional_email_data(
    requested_delivery_id,
    delivered,
    requested_provider_message_id,
    requested_error
  );
$$;

revoke all on function private.claim_transactional_emails_data(integer)
from public, anon, authenticated;
revoke all on function private.complete_transactional_email_data(uuid, boolean, text, text)
from public, anon, authenticated;
revoke all on function public.claim_transactional_emails(integer)
from public, anon, authenticated;
revoke all on function public.complete_transactional_email(uuid, boolean, text, text)
from public, anon, authenticated;

grant usage on schema private to service_role;
grant execute on function private.claim_transactional_emails_data(integer) to service_role;
grant execute on function private.complete_transactional_email_data(uuid, boolean, text, text) to service_role;
grant execute on function public.claim_transactional_emails(integer) to service_role;
grant execute on function public.complete_transactional_email(uuid, boolean, text, text) to service_role;

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare
  existing_job_id bigint;
begin
  for existing_job_id in
    select jobid
    from cron.job
    where jobname = 'brilla-transactional-emails'
  loop
    perform cron.unschedule(existing_job_id);
  end loop;

  perform cron.schedule(
    'brilla-transactional-emails',
    '* * * * *',
    $command$
      select net.http_post(
        url := (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'brilla_project_url'
        ) || '/functions/v1/send-transactional-emails',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || (
            select decrypted_secret
            from vault.decrypted_secrets
            where name = 'brilla_function_anon_key'
          ),
          'apikey', (
            select decrypted_secret
            from vault.decrypted_secrets
            where name = 'brilla_function_anon_key'
          ),
          'Content-Type', 'application/json'
        ),
        body := jsonb_build_object('scheduled_at', now()),
        timeout_milliseconds := 15000
      );
    $command$
  );
end
$$;
