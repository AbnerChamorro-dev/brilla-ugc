revoke all on schema net from public, anon, authenticated;
revoke all on all functions in schema net from public, anon, authenticated;
revoke all on all tables in schema net from public, anon, authenticated;
revoke all on all sequences in schema net from public, anon, authenticated;

grant usage on schema net to postgres;

alter default privileges for role postgres in schema net
revoke execute on functions from public;
