-- fix-moderation-trigger.sql
-- Recria (de forma idempotente) a funcao e o trigger que colocam fotos novas
-- na fila de moderacao. Sem eles, o dono sobe a foto, pending_media_url e
-- preenchido, mas moderation_status NAO vira 'pending' e a foto nunca aparece
-- no Super Admin.
--
-- Rode no SQL Editor do Supabase. Pode rodar quantas vezes quiser.

create or replace function public.guard_moderation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Super admin pode tudo.
  if not public.has_role(auth.uid(), 'super_admin') then

    -- Dono nao pode publicar direto (mexer em media_url/media_type).
    if new.media_url is distinct from old.media_url
       or new.media_type is distinct from old.media_type then
      raise exception 'Somente a equipe pode publicar mídia';
    end if;

    -- Subiu/trocou a foto nova -> entra na fila.
    if new.pending_media_url is distinct from old.pending_media_url then
      new.moderation_status := 'pending';
    -- Nao mexeu na foto -> nao pode forcar status manualmente.
    elsif new.moderation_status is distinct from old.moderation_status then
      new.moderation_status := old.moderation_status;
    end if;

  end if;
  return new;
end $$;

drop trigger if exists products_guard_moderation on public.products;

create trigger products_guard_moderation
before update on public.products
for each row execute function public.guard_moderation();

-- ---------------------------------------------------------------------------
-- Correcao dos dados ja quebrados: produtos que tem foto pendente mas ficaram
-- como 'approved'. Coloca-os de volta na fila (sem mexer nas fotos publicadas).
-- ---------------------------------------------------------------------------
-- (Backfill dos dados antigos: ver fix-moderation-backfill.sql)

-- Conferencia:
select id, name, moderation_status,
       (pending_media_url is not null) as tem_foto_nova,
       (media_url is not null)          as tem_foto_publicada
from public.products
order by moderation_status, name;