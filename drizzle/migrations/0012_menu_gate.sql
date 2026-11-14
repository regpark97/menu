-- 0012_menu_gate.sql
-- Captação opcional de contato antes do cardápio (Desbloquear cardápio).

alter table public.tenants
  add column if not exists menu_gate_enabled boolean not null default false;

create table if not exists public.menu_gate_leads (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  full_name  text not null,
  whatsapp   text not null,
  created_at timestamptz not null default now()
);

alter table public.menu_gate_leads enable row level security;

-- Visitante só pode enviar contato para um estabelecimento ATIVO. Não há
-- leitura pública: nome e WhatsApp ficam visíveis apenas ao painel do dono.
drop policy if exists "public insert menu gate leads" on public.menu_gate_leads;
create policy "public insert menu gate leads"
  on public.menu_gate_leads for insert
  to anon, authenticated
  with check (
    public.tenant_is_active(tenant_id)
    and length(trim(full_name)) between 5 and 120
    and position(' ' in trim(full_name)) > 0
    and whatsapp ~ '^[0-9]{10,15}$'
  );

drop policy if exists "owner read menu gate leads" on public.menu_gate_leads;
create policy "owner read menu gate leads"
  on public.menu_gate_leads for select
  to authenticated
  using (public.can_manage_tenant(tenant_id));

grant insert on public.menu_gate_leads to anon, authenticated;
grant select on public.menu_gate_leads to authenticated;
create index if not exists menu_gate_leads_tenant_date_idx
  on public.menu_gate_leads (tenant_id, created_at desc);

-- Expõe apenas a configuração pública, preservando o security definer
-- necessário para o cardápio anônimo funcionar após a correção da 0011.
create or replace view public.public_menu as
  select
    id, slug, name, tagline, logo_url, bg_image_url, google_review_url,
    wifi_ssid, menu_gate_enabled
  from public.tenants
  where active;

grant select on public.public_menu to anon, authenticated;