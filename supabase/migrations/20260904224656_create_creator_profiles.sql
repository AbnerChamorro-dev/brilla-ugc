create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon, authenticated;

create table public.creator_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null check (char_length(email) between 3 and 320),
  display_name text not null default '' check (char_length(display_name) <= 100),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

comment on table public.creator_profiles is
  'Private account profile for each authenticated Brilla creator.';

alter table public.creator_profiles enable row level security;

create policy "Creators can read their own profile"
on public.creator_profiles
for select
to authenticated
using ((select auth.uid()) = id);

create policy "Creators can update their own profile"
on public.creator_profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

revoke all on table public.creator_profiles from anon;
grant select on table public.creator_profiles to authenticated;
grant update (display_name) on table public.creator_profiles to authenticated;

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
    left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 100)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_creator()
from public, anon, authenticated;

create or replace function private.set_creator_profile_updated_at()
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

revoke all on function private.set_creator_profile_updated_at()
from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_creator();

create trigger creator_profiles_set_updated_at
before update on public.creator_profiles
for each row execute function private.set_creator_profile_updated_at();

insert into public.creator_profiles (id, email, display_name)
select
  id,
  coalesce(email, ''),
  left(coalesce(raw_user_meta_data ->> 'display_name', ''), 100)
from auth.users
on conflict (id) do nothing;
