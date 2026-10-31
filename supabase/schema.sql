-- Orbit database. Paste this whole file into Supabase > SQL Editor > New query, then Run.

-- One table holds every record (contacts, profiles, suggestions, meta), owned per account.
create table if not exists public.docs (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  coll text not null,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, coll, id)
);
create index if not exists docs_user_coll on public.docs (user_id, coll);

alter table public.docs enable row level security;
drop policy if exists "own docs" on public.docs;
create policy "own docs" on public.docs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Merge fields into a record (like the old update). {"__delete__":true} removes a field.
create or replace function public.doc_update(p_coll text, p_id text, p_patch jsonb)
returns void language plpgsql security invoker as $$
declare k text; v jsonb; d jsonb;
begin
  select data into d from public.docs where user_id = auth.uid() and coll = p_coll and id = p_id;
  d := coalesce(d, '{}'::jsonb);
  for k, v in select * from jsonb_each(p_patch) loop
    if jsonb_typeof(v) = 'object' and v ? '__delete__' then d := d - k; else d := d || jsonb_build_object(k, v); end if;
  end loop;
  insert into public.docs (user_id, coll, id, data, updated_at) values (auth.uid(), p_coll, p_id, d, now())
  on conflict (user_id, coll, id) do update set data = excluded.data, updated_at = now();
end $$;
grant execute on function public.doc_update(text, text, jsonb) to authenticated;

-- Live updates across your devices.
alter table public.docs replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; end $$;

-- Photos: public-read bucket with unguessable file names; only you can add or remove yours.
insert into storage.buckets (id, name, public) values ('photos', 'photos', true) on conflict (id) do nothing;
drop policy if exists "photos insert own" on storage.objects;
drop policy if exists "photos delete own" on storage.objects;
drop policy if exists "photos list own" on storage.objects;
drop policy if exists "photos update own" on storage.objects;
create policy "photos insert own" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "photos delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "photos list own" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "photos update own" on storage.objects for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
