-- 0010_lock_public_policies.sql
-- 🟠 Parte 2 da correção C2/C3 (docs/AUDITORIA-2026-11-10.md).
--
-- ⚠️ SEQUÊNCIA OBRIGATÓRIA:
--   1. Rodar 0009_public_surface.sql (view + RPCs)
--   2. Deploy do código cliente atualizado (usa a view e as RPCs)
--   3. SÓ ENTÃO rodar esta migration — ela remove o acesso público direto
--      às tabelas. Rodar antes do deploy quebra o cardápio em produção.
--
-- O que ela faz:
--   - tenants: leitura anônima agora exige ser dono/super (a view public_menu
--     cobre o cardápio; a RPC tenant_wifi cobre a senha)
--   - nfc_tags: leitura anônima liberada APENAS para o join interno das RPCs
--     (security definer ignora RLS, então resolve_tag continua funcionando)
--   - categories/products: idem — o cardápio público passa a ler pela view
--     public_menu_children (criada aqui) em vez do select direto

-- ─── View para categorias/produtos públicos ────────────────────────────────
create or replace view public.public_menu_children with (security_invoker = true) as
  select
    c.id, c.tenant_id, c.name, c.sort_order
  from public.categories c
  join public.tenants t on t.id = c.tenant_id
  where t.active;

create or replace view public.public_menu_products with (security_invoker = true) as
  select
    p.id, p.tenant_id, p.category_id, p.name, p.description, p.price_cents,
    p.media_url, p.media_type, p.media_gallery, p.modifiers,
    p.is_available, p.is_featured, p.sort_order
  from public.products p
  join public.tenants t on t.id = p.tenant_id
  where t.active and p.is_available;

grant select on public.public_menu_children to anon, authenticated;
grant select on public.public_menu_products to anon, authenticated;

-- ─── Remove o acesso público direto às tabelas ─────────────────────────────
-- tenants: só dono/super veem a tabela inteira; o público usa a view.
drop policy if exists "public read active tenants" on public.tenants;
create policy "member read tenants" on public.tenants
  for select to authenticated
  using (
    owner_user_id = auth.uid()
    or public.has_role(auth.uid(), 'super_admin')
  );

-- nfc_tags: sem leitura anônima. resolve_tag (security definer) segue
-- funcionando para o fluxo NFC; o painel usa super manage tags.
drop policy if exists "public read tags" on public.nfc_tags;

-- categories/products: sem leitura anônima direta (a view cobre o cardápio).
drop policy if exists "public read categories" on public.categories;
create policy "member read categories" on public.categories
  for select to authenticated
  using (public.can_manage_tenant(tenant_id));

drop policy if exists "public read products" on public.products;
create policy "member read products" on public.products
  for select to authenticated
  using (public.can_manage_tenant(tenant_id));

-- ─── Telemetria: a policy antiga fazia subquery em tenants com o RLS do
-- usuário anônimo. Sem leitura pública de tenants, ela falharia silenciosamente
-- (nenhum insert passaria). Substituída por helper security definer.
create or replace function public.tenant_is_active(_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.tenants where id = _tenant and active)
$$;
grant execute on function public.tenant_is_active(uuid) to anon, authenticated;

drop policy if exists "anyone logs events" on public.telemetry_events;
create policy "anyone logs events" on public.telemetry_events
  for insert to anon, authenticated
  with check (public.tenant_is_active(tenant_id));
