create table public.creator_portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  slug text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint creator_portfolios_user_id_key unique (user_id),
  constraint creator_portfolios_content_object_check check (jsonb_typeof(content) = 'object'),
  constraint creator_portfolios_status_check check (status in ('draft', 'published', 'unpublished')),
  constraint creator_portfolios_slug_check check (
    slug is null or (
      char_length(slug) between 3 and 80
      and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    )
  )
);

comment on table public.creator_portfolios is
  'Private, durable editor state for each authenticated Brilla creator.';

comment on column public.creator_portfolios.content is
  'Versionable JSON object containing the creator portfolio editor fields.';

create unique index creator_portfolios_slug_unique_idx
on public.creator_portfolios (lower(slug))
where slug is not null and status = 'published';

alter table public.creator_portfolios enable row level security;

create policy "Creators can read their own portfolio"
on public.creator_portfolios
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Creators can create their own portfolio"
on public.creator_portfolios
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Creators can update their own portfolio"
on public.creator_portfolios
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Creators can delete their own portfolio"
on public.creator_portfolios
for delete
to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.creator_portfolios from anon, authenticated;
grant select, delete on table public.creator_portfolios to authenticated;
grant insert (user_id, content, status, slug) on table public.creator_portfolios to authenticated;
grant update (content, status, slug) on table public.creator_portfolios to authenticated;

create or replace function private.set_creator_portfolio_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

revoke all on function private.set_creator_portfolio_updated_at()
from public, anon, authenticated;

create trigger creator_portfolios_set_updated_at
before update on public.creator_portfolios
for each row execute function private.set_creator_portfolio_updated_at();

create or replace function private.handle_new_creator()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.creator_profiles (id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    left(
      coalesce(
        new.raw_user_meta_data ->> 'display_name',
        new.raw_user_meta_data ->> 'full_name',
        new.raw_user_meta_data ->> 'name',
        split_part(coalesce(new.email, ''), '@', 1),
        ''
      ),
      100
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_creator()
from public, anon, authenticated;

update public.creator_profiles as profile
set display_name = left(
  coalesce(
    auth_user.raw_user_meta_data ->> 'display_name',
    auth_user.raw_user_meta_data ->> 'full_name',
    auth_user.raw_user_meta_data ->> 'name',
    split_part(coalesce(auth_user.email, ''), '@', 1),
    ''
  ),
  100
)
from auth.users as auth_user
where profile.id = auth_user.id
  and profile.display_name = '';
