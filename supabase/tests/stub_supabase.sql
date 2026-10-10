-- Simula o mínimo do Supabase (auth.users, auth.uid(), papel authenticated) para testar migrations fora da nuvem.
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as
$$ select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid $$;
grant usage on schema auth to authenticated;
grant select on auth.users to authenticated;
grant usage on schema public to authenticated;
alter default privileges in schema public grant all on tables to authenticated;
alter default privileges in schema public grant all on sequences to authenticated;
grant execute on all functions in schema public to authenticated;
do $$ begin create role authenticator login noinherit; exception when duplicate_object then null; end $$;
grant authenticated to authenticator;
grant anon to authenticator;
