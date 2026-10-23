
create policy "auth upload media" on storage.objects for insert to authenticated with check (bucket_id = 'media');
create policy "auth read media" on storage.objects for select to authenticated using (bucket_id = 'media');
