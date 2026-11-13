-- 0011_fix_public_menu_invoker.sql
-- Corrige o cardápio retornando "Estabelecimento não encontrado" para visitantes.
--
-- As views de 0009/0010 foram criadas com security_invoker = true. Isso executa
-- as tabelas-base com a RLS do VISITANTE (anon), que perdeu a leitura direta em
-- 0010. Resultado confirmado via REST anônimo: as três views devolviam [].
--
-- Removendo security_invoker, a view volta ao modo padrão (proprietário):
-- expõe somente as colunas abaixo e linhas de restaurantes ativos/produtos
-- disponíveis. Continua sem wifi_password, plan e owner_user_id.
-- Idempotente e sem alteração nas tabelas/policies privadas.

create or replace view public.public_menu as
  select
    id, slug, name, tagline, logo_url, bg_image_url, google_review_url,
    wifi_ssid
  from public.tenants
  where active;

create or replace view public.public_menu_children as
  select
    c.id, c.tenant_id, c.name, c.sort_order
  from public.categories c
  join public.tenants t on t.id = c.tenant_id
  where t.active;

create or replace view public.public_menu_products as
  select
    p.id, p.tenant_id, p.category_id, p.name, p.description, p.price_cents,
    p.media_url, p.media_type, p.media_gallery, p.modifiers,
    p.is_available, p.is_featured, p.sort_order
  from public.products p
  join public.tenants t on t.id = p.tenant_id
  where t.active and p.is_available;

grant select on public.public_menu to anon, authenticated;
grant select on public.public_menu_children to anon, authenticated;
grant select on public.public_menu_products to anon, authenticated;