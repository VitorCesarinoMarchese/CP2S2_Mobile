-- Run once in the Supabase SQL Editor. Images are public; writes require
-- signed URLs issued by the Firebase-authenticated Brisa API.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('brisa-photos', 'brisa-photos', true, 5242879,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Do not add INSERT, UPDATE or DELETE policies for anon/authenticated.
-- Use a dedicated Supabase project without existing permissive object policies.
