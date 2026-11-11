-- 0009_public_surface.sql
-- 🟠 Correção dos achados C2/C3 da auditoria (docs/AUDITORIA-2026-11-10.md):
--
--   C2: a policy "public read tags" liberava a lista COMPLETA de tags
--       (tag_code, tenant_id, table_label) para qualquer anônimo.
--   C3: a policy "public read active tenants" expunha `wifi_password`,
--       plano e owner para qualquer anônimo com a anon key.
--
-- Esta migration enxuga a superfície pública:
--
--   1. View `public_menu` — tudo que o cardápio público (/c/:slug) precisa,
--      SEM colunas sensíveis (sem wifi_password, sem plan, sem owner_user_id).
--   2. RPC `tenant_wifi(_slug)` — devolve SSID+senha sob demanda (o cardápio
--      só busca quando o cliente abre o modal de Wi-Fi).
--   3. RPC `resolve_tag(_code)` — o destino da tag NFC (/t/:tag) passa a
--      consultar por RPC em vez de select direto na tabela.
--
-- ⚠️ IMPORTANTE — aplicar junto com a troca do código do cliente:
--   depois de rodar esta migration, rodar também a 0010 (polices), que
--   REMOVE as policies públicas de tenants/nfc_tags. Entre a 0009 e a 0010
--   o sistema continua funcionando (policies antigas ainda valem); a 0010
--   fecha a exposição.
--
-- Idempotente: create or replace / if not exists em tudo.

-- ─── 1. View pública enxuta (o que o cardápio realmente usa) ───────────────
create or replace view public.public_menu with (security_invoker = true) as
  select
    id, slug, name, tagline, logo_url, bg_image_url, google_review_url,
    wifi_ssid  -- nome da rede é exibido no botão; a senha NÃO está aqui
  from public.tenants
  where active;

grant select on public.public_menu to anon, authenticated;

-- ─── 2. Senha do Wi-Fi sob demanda ─────────────────────────────────────────
-- Devolve {ssid, password} apenas do tenant ativo com wifi configurado.
-- O cardápio chama ao abrir o modal (rastreável em logs de API, se precisar).
create or replace function public.tenant_wifi(_slug text)
returns table (ssid text, password text)
language sql
stable
security definer
set search_path = public
as $$
  select t.wifi_ssid, t.wifi_password
  from public.tenants t
  where t.slug = lower(_slug)
    and t.active
    and t.wifi_ssid is not null
    and t.wifi_password is not null
$$;

grant execute on function public.tenant_wifi(text) to anon, authenticated;

-- ─── 3. Resolvedor da tag NFC ──────────────────────────────────────────────
-- /t/:tag chama isto. Devolve só o necessário: slug de destino, mesa,
-- redirect externo (tags genéricas) e se está ativo. Não existe mais forma
-- de ENUMERAR as tags via select público.
create or replace function public.resolve_tag(_code text)
returns table (slug text, table_label text, custom_redirect_url text, active boolean)
language sql
stable
security definer
set search_path = public
as $$
  select t.slug, n.table_label, n.custom_redirect_url, n.active and t.active
  from public.nfc_tags n
  join public.tenants t on t.id = n.tenant_id
  where n.tag_code = lower(_code)
$$;

grant execute on function public.resolve_tag(text) to anon, authenticated;
