-- Keep browser access limited to the four operations used by Brilla.
-- RLS policies continue to restrict every operation to auth.uid() = user_id.
revoke all on table public.creator_media from anon, authenticated;
grant select, insert, update, delete on table public.creator_media to authenticated;
