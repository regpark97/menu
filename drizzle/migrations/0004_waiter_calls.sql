-- 0004_waiter_calls.sql
-- Chamadas de garcom / conta / gerente feitas pelo cliente no cardapio.
-- O cliente (anonimo) INSERE via RPC; o painel do dono escuta em tempo real.

create table if not exists public.waiter_calls (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  table_ref text,
  kind text not null default 'waiter', -- waiter | bill | manager
  status text not null default 'pending', -- pending | done
  created_at timestamptz not null default now(),
  done_at timestamptz
);

create index if not exists waiter_calls_tenant_status_idx
  on public.waiter_calls (tenant_id, status, created_at desc);

alter table public.waiter_calls enable row level security;

-- Dono ve as chamadas do proprio tenant.
drop policy if exists "owner read waiter calls" on public.waiter_calls;
create policy "owner read waiter calls" on public.waiter_calls
  for select to authenticated
  using (public.can_manage_tenant(tenant_id));

-- Dono marca como atendido (update) do proprio tenant.
drop policy if exists "owner update waiter calls" on public.waiter_calls;
create policy "owner update waiter calls" on public.waiter_calls
  for update to authenticated
  using (public.can_manage_tenant(tenant_id))
  with check (public.can_manage_tenant(tenant_id));

-- Super admin ve/atualiza tudo.
drop policy if exists "super read waiter calls" on public.waiter_calls;
create policy "super read waiter calls" on public.waiter_calls
  for select to authenticated
  using (public.has_role(auth.uid(), 'super_admin'));

drop policy if exists "super update waiter calls" on public.waiter_calls;
create policy "super update waiter calls" on public.waiter_calls
  for update to authenticated
  using (public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'super_admin'));

-- Anti-spam + insercao do cliente. SECURITY DEFINER: permite anonimo inserir
-- sem expor a tabela, e valida cooldown de 2 min por mesa.
create or replace function public.call_waiter(
  _tenant uuid,
  _table text,
  _kind text default 'waiter'
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  last_call timestamptz;
  new_id uuid;
begin
  select created_at into last_call
  from public.waiter_calls
  where tenant_id = _tenant
    and coalesce(table_ref, '') = coalesce(_table, '')
    and created_at > now() - interval '2 minutes'
  order by created_at desc
  limit 1;

  if last_call is not null then
    raise exception 'Aguarde alguns instantes antes de chamar de novo';
  end if;

  insert into public.waiter_calls (tenant_id, table_ref, kind)
  values (_tenant, _table, coalesce(nullif(_kind, ''), 'waiter'))
  returning id into new_id;

  return new_id;
end $$;

grant execute on function public.call_waiter(uuid, text, text) to anon, authenticated;

-- Habilita Realtime na tabela (ignora erro se ja estiver habilitada).
do $$
begin
  alter publication supabase_realtime add table public.waiter_calls;
exception when duplicate_object then null;
end $$;
