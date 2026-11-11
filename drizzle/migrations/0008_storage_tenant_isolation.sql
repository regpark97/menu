-- 0008_storage_tenant_isolation.sql
-- 🔴 Correção do achado C1 da auditoria (docs/AUDITORIA-2026-11-10.md):
--
-- As policies do bucket `media` (0002) aceitavam upload/update/delete de QUALQUER
-- usuário autenticado em QUALQUER objeto do bucket — inclusive mídia de outro
-- estabelecimento. Esta migration amarra cada operação ao prefixo do tenant:
--
--   path do upload (convenção de src/lib/media.ts):
--     {tenantId}/{productId}          → capa do prato
--     {tenantId}/{productId}/gallery  → fotos extras
--     {tenantId}/logo | {tenantId}/bg → identidade da loja
--
--   A policy exige que a PRIMEIRA pasta do path seja um tenant que o usuário
--   pode gerenciar (dono ou super_admin). Super admin mantém acesso total.
--
-- Idempotente: drop + recreate das policies.

-- Helper: o usuário é super_admin OU dono do tenant indicado pelo prefixo do path.
-- Chamado pelas policies de storage (storage.objects) via security definer.
create or replace function public.owns_storage_prefix(prefix text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.tenants t
    where t.id::text = prefix
      and (
        t.owner_user_id = auth.uid()
        or public.has_role(auth.uid(), 'super_admin')
      )
  )
$$;

grant execute on function public.owns_storage_prefix(text) to authenticated;

-- ─── INSERT (upload) ────────────────────────────────────────────────────────
drop policy if exists "auth upload media" on storage.objects;
create policy "auth upload media" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'media'
    and public.owns_storage_prefix((storage.foldername(name))[1])
  );

-- ─── SELECT (leitura de URL assinada / listagem) ───────────────────────────
-- Leitura permanece pública (o cardápio do cliente precisa exibir a mídia):
drop policy if exists "public read public media" on storage.objects;
create policy "public read public media" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'media');

-- ─── UPDATE (substituir foto) ──────────────────────────────────────────────
drop policy if exists "auth update media" on storage.objects;
create policy "auth update media" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'media'
    and public.owns_storage_prefix((storage.foldername(name))[1])
  )
  with check (
    bucket_id = 'media'
    and public.owns_storage_prefix((storage.foldername(name))[1])
  );

-- ─── DELETE (remover foto antiga) ──────────────────────────────────────────
drop policy if exists "auth delete media" on storage.objects;
create policy "auth delete media" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'media'
    and public.owns_storage_prefix((storage.foldername(name))[1])
  );
