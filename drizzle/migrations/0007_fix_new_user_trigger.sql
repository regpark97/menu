-- Corrige o trigger on_auth_user_created:
--
-- A migration 0000 promovia automaticamente o PRIMEIRO usuário do banco a
-- super_admin (e o vinculava ao tenant de demonstração). Isso já era um risco
-- (qualquer estranho que se cadastrasse primeiro em produção se tornaria
-- dono do painel mestre), e com a landing page no ar expondo /auth o risco
-- se tornou crítico.
--
-- Este arquivo alinha o trigger com a versão segura do hardening.sql:
-- todo usuário novo nasce como 'user'; super_admin é concedido manualmente
-- por quem já tem acesso ao banco.

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_roles(user_id, role) values (new.id, 'user')
  on conflict do nothing;
  return new;
end $$;
