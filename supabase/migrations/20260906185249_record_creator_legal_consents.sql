create table public.creator_legal_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  data_policy_version text not null default '2026-09-06',
  terms_version text not null default '2026-09-06',
  authorization_text text not null default 'Autorizo de manera previa, expresa e informada a TECNOLOGYC S.A.S. para recolectar, almacenar, usar, circular, transmitir y suprimir mis datos personales con las finalidades descritas en la Política de Tratamiento de Datos de Brilla, y declaro que leí y acepto los Términos de Uso.',
  accepted_via text not null,
  accepted_at timestamptz not null default now(),
  constraint creator_legal_consents_version_check check (
    data_policy_version ~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$'
    and terms_version ~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$'
  ),
  constraint creator_legal_consents_acceptance_check check (
    accepted_via in ('google_oauth', 'authenticated_prompt')
  ),
  constraint creator_legal_consents_version_key unique (
    user_id,
    data_policy_version,
    terms_version
  )
);

comment on table public.creator_legal_consents is
  'Immutable, versioned proof of each creator authorization for personal-data processing and acceptance of Brilla terms.';

comment on column public.creator_legal_consents.authorization_text is
  'Exact authorization presented for the corresponding policy and terms versions. The client cannot override this value.';

create index creator_legal_consents_user_accepted_idx
on public.creator_legal_consents (user_id, accepted_at desc);

alter table public.creator_legal_consents enable row level security;

create policy "Creators can read their own legal consents"
on public.creator_legal_consents
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Creators can record their own legal consent"
on public.creator_legal_consents
for insert
to authenticated
with check ((select auth.uid()) = user_id);

revoke all on table public.creator_legal_consents
from public, anon, authenticated;
grant select on table public.creator_legal_consents to authenticated;
grant insert (user_id, accepted_via)
on table public.creator_legal_consents to authenticated;
