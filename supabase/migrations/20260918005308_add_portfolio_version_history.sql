create table public.creator_portfolio_versions (
  id bigint generated always as identity primary key,
  portfolio_id uuid not null references public.creator_portfolios(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content jsonb not null default '{}'::jsonb,
  status text not null,
  slug text,
  source_updated_at timestamptz not null,
  reason text not null default 'interval'
    check (reason in ('baseline', 'interval', 'protective', 'status_change')),
  created_at timestamptz not null default timezone('utc', now())
);

create index creator_portfolio_versions_owner_created_idx
  on public.creator_portfolio_versions (user_id, created_at desc);

create index creator_portfolio_versions_portfolio_created_idx
  on public.creator_portfolio_versions (portfolio_id, created_at desc);

alter table public.creator_portfolio_versions enable row level security;

create policy "Creators can read their portfolio versions"
  on public.creator_portfolio_versions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.creator_portfolio_versions from anon, authenticated;
grant select on table public.creator_portfolio_versions to authenticated;

create or replace function private.capture_creator_portfolio_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  snapshot_reason text;
  old_size integer;
  new_size integer;
begin
  if old.content is not distinct from new.content
    and old.status is not distinct from new.status
    and old.slug is not distinct from new.slug then
    return new;
  end if;

  old_size := octet_length(old.content::text);
  new_size := octet_length(new.content::text);

  if old.status is distinct from new.status or old.slug is distinct from new.slug then
    snapshot_reason := 'status_change';
  elsif old_size >= 250 and new_size < old_size * 0.65 then
    snapshot_reason := 'protective';
  elsif not exists (
    select 1
    from public.creator_portfolio_versions versions
    where versions.portfolio_id = old.id
      and versions.created_at > timezone('utc', now()) - interval '5 minutes'
  ) then
    snapshot_reason := 'interval';
  else
    return new;
  end if;

  insert into public.creator_portfolio_versions (
    portfolio_id,
    user_id,
    content,
    status,
    slug,
    source_updated_at,
    reason
  ) values (
    old.id,
    old.user_id,
    old.content,
    old.status,
    old.slug,
    old.updated_at,
    snapshot_reason
  );

  delete from public.creator_portfolio_versions versions
  where versions.portfolio_id = old.id
    and versions.id in (
      select stale.id
      from public.creator_portfolio_versions stale
      where stale.portfolio_id = old.id
      order by stale.created_at desc, stale.id desc
      offset 200
    );

  return new;
end;
$$;

revoke all on function private.capture_creator_portfolio_version() from public;

create trigger capture_creator_portfolio_version
before update of content, status, slug on public.creator_portfolios
for each row execute function private.capture_creator_portfolio_version();

insert into public.creator_portfolio_versions (
  portfolio_id,
  user_id,
  content,
  status,
  slug,
  source_updated_at,
  reason
)
select id, user_id, content, status, slug, updated_at, 'baseline'
from public.creator_portfolios;

create or replace function public.restore_my_portfolio_version(p_version_id bigint)
returns table (updated_at timestamptz)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved_version public.creator_portfolio_versions%rowtype;
begin
  select versions.*
  into saved_version
  from public.creator_portfolio_versions versions
  where versions.id = p_version_id
    and versions.user_id = (select auth.uid());

  if not found then
    raise exception 'Portfolio version not found';
  end if;

  return query
  update public.creator_portfolios portfolios
  set content = saved_version.content,
      status = saved_version.status,
      slug = saved_version.slug
  where portfolios.id = saved_version.portfolio_id
    and portfolios.user_id = (select auth.uid())
  returning portfolios.updated_at;

  if not found then
    raise exception 'Portfolio not found';
  end if;
end;
$$;

revoke all on function public.restore_my_portfolio_version(bigint) from public;
grant execute on function public.restore_my_portfolio_version(bigint) to authenticated;
