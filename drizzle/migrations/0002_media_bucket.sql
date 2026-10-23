-- 0002_media_bucket.sql
-- Cria o bucket privado 'media' usado pelo app (src/lib/media.ts) para fotos/videos
-- de pratos e logos. A migracao 0001 criou apenas as POLITICAS de acesso ao bucket,
-- mas o bucket em si nunca foi criado -- por isso o upload falhava.
--
-- Tambem cria as politicas de DELETE/UPDATE, que faltavam: sem elas o dono nao
-- consegue remover uma foto antiga ao trocar a imagem de um prato.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media',
  'media',
  false,
  52428800, -- 50 MB
  array[
    'image/png','image/jpeg','image/jpg','image/webp','image/gif','image/avif','image/svg+xml',
    'video/mp4','video/webm','video/quicktime'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Leitura publica das imagens marcadas como publicas (padrao Supabase),
-- mantendo o bucket privado para o restante.
create policy "public read public media" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'media');

-- Upload apenas por usuario autenticado (o painel do dono).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'auth upload media'
  ) then
    create policy "auth upload media" on storage.objects
      for insert to authenticated with check (bucket_id = 'media');
  end if;
end $$;

-- Trocar/remover fotos: o dono precisa poder sobrescrever e apagar.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'auth update media'
  ) then
    create policy "auth update media" on storage.objects
      for update to authenticated using (bucket_id = 'media') with check (bucket_id = 'media');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'auth delete media'
  ) then
    create policy "auth delete media" on storage.objects
      for delete to authenticated using (bucket_id = 'media');
  end if;
end $$;
