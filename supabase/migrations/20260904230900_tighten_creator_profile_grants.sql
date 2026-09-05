revoke all on table public.creator_profiles from authenticated;
grant select on table public.creator_profiles to authenticated;
grant update (display_name) on table public.creator_profiles to authenticated;
