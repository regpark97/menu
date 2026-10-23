-- ============================================================================
-- SipFlow — RPC para o Super Admin achar usuário por e-mail
-- ----------------------------------------------------------------------------
-- O app nunca consegue ler `auth.users` pelo cliente. Esta função, restrita a
-- super admins, devolve apenas o UUID de um e-mail informado — é o que permite
-- "Vincular dono" digitando o e-mail, em vez de colar um UUID na mão.
--
-- Segurança:
--   • SECURITY DEFINER, mas com uma trava explícita no início: quem não for
--     super_admin leva exceção. Não vaza e-mail de ninguém.
--   • Rodar DEPOIS de supabase/hardening.sql.
-- ============================================================================

create or replace function public.user_id_by_email(_email text)
returns uuid
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  _uid uuid;
begin
  if not public.has_role(auth.uid(), 'super_admin') then
    raise exception 'Acesso restrito à equipe SipFlow';
  end if;

  select id into _uid from auth.users where lower(email) = lower(trim(_email)) limit 1;
  return _uid;  -- null quando não existe conta com esse e-mail
end $$;

revoke all on function public.user_id_by_email(text) from public, anon;
grant execute on function public.user_id_by_email(text) to authenticated;
