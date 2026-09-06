create table private.portfolio_events (
  id bigint generated always as identity primary key,
  portfolio_id uuid not null references public.creator_portfolios(id) on delete cascade,
  visitor_token text not null,
  event_type text not null,
  event_target text not null default 'portfolio',
  occurred_at timestamptz not null default timezone('utc'::text, now()),
  window_start timestamptz not null,
  constraint portfolio_events_visitor_token_check check (
    char_length(visitor_token) = 64
    and visitor_token ~ '^[a-f0-9]{64}$'
  ),
  constraint portfolio_events_type_check check (event_type in ('view', 'click')),
  constraint portfolio_events_target_check check (
    event_target in ('portfolio', 'email', 'whatsapp', 'instagram', 'tiktok')
  ),
  constraint portfolio_events_type_target_check check (
    (event_type = 'view' and event_target = 'portfolio')
    or (event_type = 'click' and event_target <> 'portfolio')
  ),
  constraint portfolio_events_deduplication_key unique (
    portfolio_id,
    visitor_token,
    event_type,
    event_target,
    window_start
  )
);

comment on table private.portfolio_events is
  'Anonymous, deduplicated visits and contact clicks for published Brilla portfolios.';

comment on column private.portfolio_events.visitor_token is
  'Random browser token containing no name, email, social profile, or IP address.';

create index portfolio_events_portfolio_occurred_idx
on private.portfolio_events (portfolio_id, occurred_at desc);

create index portfolio_events_click_target_idx
on private.portfolio_events (portfolio_id, event_target, occurred_at desc)
where event_type = 'click';

alter table private.portfolio_events enable row level security;
revoke all on table private.portfolio_events from public, anon, authenticated;

create table public.creator_notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_digest_enabled boolean not null default false,
  digest_frequency text not null default 'weekly',
  last_sent_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint creator_notification_preferences_frequency_check check (
    digest_frequency in ('daily', 'weekly')
  )
);

comment on table public.creator_notification_preferences is
  'Creator-controlled analytics email preferences. Delivery is rate-limited using last_sent_at.';

alter table public.creator_notification_preferences enable row level security;

create policy "Creators can read their notification preferences"
on public.creator_notification_preferences
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Creators can create their notification preferences"
on public.creator_notification_preferences
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Creators can update their notification preferences"
on public.creator_notification_preferences
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Creators can delete their notification preferences"
on public.creator_notification_preferences
for delete
to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.creator_notification_preferences from anon, authenticated;
grant select, delete on table public.creator_notification_preferences to authenticated;
grant insert (user_id, email_digest_enabled, digest_frequency)
on table public.creator_notification_preferences to authenticated;
grant update (email_digest_enabled, digest_frequency)
on table public.creator_notification_preferences to authenticated;

create trigger creator_notification_preferences_set_updated_at
before update on public.creator_notification_preferences
for each row execute function private.set_creator_portfolio_updated_at();

create or replace function private.record_portfolio_event_data(
  requested_slug text,
  visitor_token text,
  requested_event text,
  requested_target text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  matched_portfolio_id uuid;
  deduplication_window timestamptz;
  inserted_rows integer;
begin
  if requested_slug is null
    or char_length(requested_slug) not between 3 and 80
    or requested_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    or visitor_token is null
    or visitor_token !~ '^[a-f0-9]{64}$'
    or char_length(visitor_token) <> 64
    or requested_event is null
    or requested_event not in ('view', 'click')
    or requested_target is null
    or requested_target not in ('portfolio', 'email', 'whatsapp', 'instagram', 'tiktok')
    or (requested_event = 'view' and requested_target <> 'portfolio')
    or (requested_event = 'click' and requested_target = 'portfolio') then
    return false;
  end if;

  select portfolio.id
  into matched_portfolio_id
  from public.creator_portfolios as portfolio
  where portfolio.status = 'published'
    and lower(portfolio.slug) = lower(requested_slug)
    and coalesce(portfolio.content ->> 'visibility', 'public') = 'public'
  limit 1;

  if matched_portfolio_id is null then
    return false;
  end if;

  deduplication_window := date_bin(
    interval '30 minutes',
    now(),
    timestamptz '2000-01-01 00:00:00+00'
  );

  insert into private.portfolio_events (
    portfolio_id,
    visitor_token,
    event_type,
    event_target,
    window_start
  )
  values (
    matched_portfolio_id,
    visitor_token,
    requested_event,
    requested_target,
    deduplication_window
  )
  on conflict on constraint portfolio_events_deduplication_key do nothing;

  get diagnostics inserted_rows = row_count;
  return inserted_rows = 1;
end;
$$;

create or replace function public.record_portfolio_event(
  requested_slug text,
  visitor_token text,
  requested_event text,
  requested_target text
)
returns boolean
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.record_portfolio_event_data(
    requested_slug,
    visitor_token,
    requested_event,
    requested_target
  );
$$;

create or replace function private.get_my_portfolio_analytics_data()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with owned_portfolio as (
    select portfolio.id
    from public.creator_portfolios as portfolio
    where portfolio.user_id = (select auth.uid())
    limit 1
  )
  select jsonb_build_object(
    'total_views', count(*) filter (where event.event_type = 'view'),
    'unique_visitors', count(distinct event.visitor_token) filter (where event.event_type = 'view'),
    'views_last_30_days', count(*) filter (
      where event.event_type = 'view'
        and event.occurred_at >= now() - interval '30 days'
    ),
    'last_view_at', max(event.occurred_at) filter (where event.event_type = 'view'),
    'clicks', jsonb_build_object(
      'email', count(*) filter (where event.event_type = 'click' and event.event_target = 'email'),
      'whatsapp', count(*) filter (where event.event_type = 'click' and event.event_target = 'whatsapp'),
      'instagram', count(*) filter (where event.event_type = 'click' and event.event_target = 'instagram'),
      'tiktok', count(*) filter (where event.event_type = 'click' and event.event_target = 'tiktok')
    )
  )
  from private.portfolio_events as event
  where event.portfolio_id = (select id from owned_portfolio);
$$;

create or replace function public.get_my_portfolio_analytics()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.get_my_portfolio_analytics_data();
$$;

revoke all on function private.record_portfolio_event_data(text, text, text, text)
from public, anon, authenticated;
revoke all on function private.get_my_portfolio_analytics_data()
from public, anon, authenticated;
revoke all on function public.record_portfolio_event(text, text, text, text)
from public, anon, authenticated;
revoke all on function public.get_my_portfolio_analytics()
from public, anon, authenticated;

grant execute on function private.record_portfolio_event_data(text, text, text, text)
to anon, authenticated;
grant execute on function private.get_my_portfolio_analytics_data()
to authenticated;
grant execute on function public.record_portfolio_event(text, text, text, text)
to anon, authenticated;
grant execute on function public.get_my_portfolio_analytics()
to authenticated;
