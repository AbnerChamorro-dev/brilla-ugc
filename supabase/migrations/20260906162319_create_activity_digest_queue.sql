create table private.activity_digest_deliveries (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.creator_portfolios(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  digest_frequency text not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  status text not null default 'pending',
  attempt_count smallint not null default 0,
  next_attempt_at timestamptz,
  provider_message_id text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  constraint activity_digest_deliveries_frequency_check check (
    digest_frequency in ('daily', 'weekly')
  ),
  constraint activity_digest_deliveries_period_check check (period_end > period_start),
  constraint activity_digest_deliveries_status_check check (
    status in ('pending', 'processing', 'sent', 'failed')
  ),
  constraint activity_digest_deliveries_attempt_count_check check (
    attempt_count between 0 and 3
  ),
  constraint activity_digest_deliveries_period_key unique (
    portfolio_id,
    digest_frequency,
    period_start
  )
);

comment on table private.activity_digest_deliveries is
  'Idempotent delivery queue for daily and weekly creator activity summaries.';

create index activity_digest_deliveries_claim_idx
on private.activity_digest_deliveries (next_attempt_at, created_at)
where status in ('pending', 'failed') and attempt_count < 3;

create index activity_digest_deliveries_stuck_idx
on private.activity_digest_deliveries (updated_at)
where status = 'processing' and attempt_count < 3;

create index activity_digest_deliveries_user_created_idx
on private.activity_digest_deliveries (user_id, created_at desc);

alter table private.activity_digest_deliveries enable row level security;
revoke all on table private.activity_digest_deliveries from public, anon, authenticated;

create policy "Activity digest deliveries cannot be read directly"
on private.activity_digest_deliveries
for select
to anon, authenticated
using (false);

create policy "Activity digest deliveries cannot be inserted directly"
on private.activity_digest_deliveries
for insert
to anon, authenticated
with check (false);

create policy "Activity digest deliveries cannot be updated directly"
on private.activity_digest_deliveries
for update
to anon, authenticated
using (false)
with check (false);

create policy "Activity digest deliveries cannot be deleted directly"
on private.activity_digest_deliveries
for delete
to anon, authenticated
using (false);

create trigger activity_digest_deliveries_set_updated_at
before update on private.activity_digest_deliveries
for each row execute function private.set_creator_portfolio_updated_at();

create or replace function private.claim_activity_digests_data(requested_batch_size integer default 25)
returns table (
  delivery_id uuid,
  recipient_email text,
  creator_name text,
  portfolio_slug text,
  digest_frequency text,
  period_start timestamptz,
  period_end timestamptz,
  total_views bigint,
  unique_visitors bigint,
  email_clicks bigint,
  whatsapp_clicks bigint,
  instagram_clicks bigint,
  tiktok_clicks bigint
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  insert into private.activity_digest_deliveries (
    portfolio_id,
    user_id,
    digest_frequency,
    period_start,
    period_end,
    next_attempt_at
  )
  select
    portfolio.id,
    preferences.user_id,
    preferences.digest_frequency,
    bounds.period_start,
    bounds.period_end,
    now()
  from public.creator_notification_preferences as preferences
  join public.creator_portfolios as portfolio
    on portfolio.user_id = preferences.user_id
  join auth.users as auth_user
    on auth_user.id = preferences.user_id
  left join public.creator_profiles as profile
    on profile.id = preferences.user_id
  cross join lateral (
    select
      case
        when preferences.digest_frequency = 'daily'
          then date_trunc('day', now()) - interval '1 day'
        else date_trunc('week', now()) - interval '1 week'
      end as period_start,
      case
        when preferences.digest_frequency = 'daily'
          then date_trunc('day', now())
        else date_trunc('week', now())
      end as period_end
  ) as bounds
  where preferences.email_digest_enabled
    and portfolio.status = 'published'
    and coalesce(nullif(profile.email, ''), auth_user.email, '') <> ''
    and (
      preferences.digest_frequency = 'daily'
      or extract(isodow from now()) = 1
    )
    and exists (
      select 1
      from private.portfolio_events as event
      where event.portfolio_id = portfolio.id
        and event.occurred_at >= bounds.period_start
        and event.occurred_at < bounds.period_end
    )
  on conflict on constraint activity_digest_deliveries_period_key do nothing;

  return query
  with claimable as (
    select delivery.id
    from private.activity_digest_deliveries as delivery
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
    update private.activity_digest_deliveries as delivery
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
    coalesce(nullif(profile.email, ''), auth_user.email, ''),
    coalesce(nullif(profile.display_name, ''), 'creadora'),
    portfolio.slug,
    claimed.digest_frequency,
    claimed.period_start,
    claimed.period_end,
    count(event.id) filter (where event.event_type = 'view'),
    count(distinct event.visitor_token) filter (where event.event_type = 'view'),
    count(event.id) filter (where event.event_type = 'click' and event.event_target = 'email'),
    count(event.id) filter (where event.event_type = 'click' and event.event_target = 'whatsapp'),
    count(event.id) filter (where event.event_type = 'click' and event.event_target = 'instagram'),
    count(event.id) filter (where event.event_type = 'click' and event.event_target = 'tiktok')
  from claimed
  join public.creator_portfolios as portfolio
    on portfolio.id = claimed.portfolio_id
  join auth.users as auth_user
    on auth_user.id = claimed.user_id
  left join public.creator_profiles as profile
    on profile.id = claimed.user_id
  left join private.portfolio_events as event
    on event.portfolio_id = claimed.portfolio_id
    and event.occurred_at >= claimed.period_start
    and event.occurred_at < claimed.period_end
  where coalesce(nullif(profile.email, ''), auth_user.email, '') <> ''
  group by
    claimed.id,
    profile.email,
    profile.display_name,
    auth_user.email,
    portfolio.slug,
    claimed.digest_frequency,
    claimed.period_start,
    claimed.period_end;
end;
$$;

create or replace function public.claim_activity_digests(requested_batch_size integer default 25)
returns table (
  delivery_id uuid,
  recipient_email text,
  creator_name text,
  portfolio_slug text,
  digest_frequency text,
  period_start timestamptz,
  period_end timestamptz,
  total_views bigint,
  unique_visitors bigint,
  email_clicks bigint,
  whatsapp_clicks bigint,
  instagram_clicks bigint,
  tiktok_clicks bigint
)
language sql
volatile
security invoker
set search_path = ''
as $$
  select * from private.claim_activity_digests_data(requested_batch_size);
$$;

create or replace function private.complete_activity_digest_data(
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
  delivery_user_id uuid;
  delivered_through timestamptz;
  delivery_attempts smallint;
begin
  select delivery.user_id, delivery.period_end, delivery.attempt_count
  into delivery_user_id, delivered_through, delivery_attempts
  from private.activity_digest_deliveries as delivery
  where delivery.id = requested_delivery_id
    and delivery.status = 'processing'
  for update;

  if delivery_user_id is null then
    return false;
  end if;

  if delivered then
    update private.activity_digest_deliveries as delivery
    set
      status = 'sent',
      provider_message_id = left(coalesce(requested_provider_message_id, ''), 255),
      last_error = null,
      next_attempt_at = null,
      sent_at = now()
    where delivery.id = requested_delivery_id;

    update public.creator_notification_preferences as preferences
    set last_sent_at = greatest(
      coalesce(preferences.last_sent_at, '-infinity'::timestamptz),
      delivered_through
    )
    where preferences.user_id = delivery_user_id;
  else
    update private.activity_digest_deliveries as delivery
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

create or replace function public.complete_activity_digest(
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
  select private.complete_activity_digest_data(
    requested_delivery_id,
    delivered,
    requested_provider_message_id,
    requested_error
  );
$$;

revoke all on function private.claim_activity_digests_data(integer)
from public, anon, authenticated;
revoke all on function private.complete_activity_digest_data(uuid, boolean, text, text)
from public, anon, authenticated;
revoke all on function public.claim_activity_digests(integer)
from public, anon, authenticated;
revoke all on function public.complete_activity_digest(uuid, boolean, text, text)
from public, anon, authenticated;

grant usage on schema private to service_role;
grant execute on function private.claim_activity_digests_data(integer) to service_role;
grant execute on function private.complete_activity_digest_data(uuid, boolean, text, text) to service_role;
grant execute on function public.claim_activity_digests(integer) to service_role;
grant execute on function public.complete_activity_digest(uuid, boolean, text, text) to service_role;
