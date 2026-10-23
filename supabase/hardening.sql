-- ============================================================================
-- SipFlow — Correção de segurança (rodar no Supabase → SQL Editor)
-- ----------------------------------------------------------------------------
-- Corrige dois furos críticos:
--   1) Qualquer usuário logado podia se promover a Super Admin, porque
--      `user_roles` tinha RLS ativo + GRANT para `authenticated`, mas NENHUMA
--      policy de INSERT/DELETE. No Postgres, "sem policy" = liberado.
--   2) O gatilho `handle_new_user` promovia o primeiro usuário cadastrado a
--      Super Admin. Se o seu usuário sumisse, o próximo estranho que se
--      cadastrasse virava dono do sistema.
--
-- Depois desta correção:
--   • ninguém cria/edita/apaga papéis pelo cliente (só service_role, que ignora RLS);
--   • todo novo usuário entra como 'user', sempre;
--   • o Super Admin é concedido à mão por você (bloco no fim do arquivo).
--
-- É idempotente: pode rodar quantas vezes quiser.
-- ============================================================================

-- 1. Papéis: leitura apenas dos próprios papéis (ou de tudo, se for super admin).
drop policy if exists "own roles" on public.user_roles;
drop policy if exists "read own roles" on public.user_roles;
create policy "read own roles" on public.user_roles
  for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'super_admin'));

-- 2. Novo usuário entra sempre como 'user'. Fim do "primeiro cadastrado manda".
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_roles(user_id, role) values (new.id, 'user')
  on conflict do nothing;
  return new;
end $$;

-- 3. (Opcional, recomendado) Cardápio só mostra estabelecimento ativo.
--    Descomente para ativar. Antes disso, garanta que os clientes reais estão
--    com `active = true` — senão o cardápio deles desaparece.
-- drop policy if exists "public read categories" on public.categories;
-- create policy "public read categories" on public.categories
--   for select to anon, authenticated
--   using (exists (select 1 from public.tenants t where t.id = tenant_id and t.active));
-- drop policy if exists "public read products" on public.products;
-- create policy "public read products" on public.products
--   for select to anon, authenticated
--   using (exists (select 1 from public.tenants t where t.id = tenant_id and t.active));


-- ============================================================================
-- CONCEDER SUPER ADMIN A ALGUÉM (rodar só quando precisar)
-- ----------------------------------------------------------------------------
-- Pegue o UUID em: Authentication → Users (coluna "UID") ou na tabela abaixo.
-- Descomente, troque o e-mail e rode.
--
-- insert into public.user_roles (user_id, role)
-- select id, 'super_admin' from auth.users where email = 'seu-email@exemplo.com'
-- on conflict do nothing;
--
-- ----------------------------------------------------------------------------
-- REVOGAR SUPER ADMIN
-- delete from public.user_roles
-- where role = 'super_admin'
--   and user_id = (select id from auth.users where email = 'email-a-revogar@exemplo.com');
-- ============================================================================

-- Conferência: quem é Super Admin hoje?
select u.email, r.role, r.user_id
from public.user_roles r
join auth.users u on u.id = r.user_id
where r.role = 'super_admin';
