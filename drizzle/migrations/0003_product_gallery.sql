-- 0003_product_gallery.sql
-- Galeria de fotos por produto (varias fotos, alem da capa).
--
-- media_url        -> continua sendo a FOTO PRINCIPAL (capa) do produto.
-- media_gallery    -> lista de fotos extras: jsonb [{ "url": text, "type": "image"|"video" }]
-- pending_media_url     -> foto nova aguardando aprovacao (capa)
-- pending_media_gallery -> galeria nova aguardando aprovacao

alter table public.products
  add column if not exists media_gallery jsonb not null default '[]'::jsonb;

alter table public.products
  add column if not exists pending_media_gallery jsonb not null default '[]'::jsonb;

-- O trigger de moderacao passa a tratar a galeria pendente tambem:
-- se a galeria pendente muda, o produto entra em 'pending'.
create or replace function public.guard_moderation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'super_admin') then
    if new.media_url is distinct from old.media_url
       or new.media_type is distinct from old.media_type
       or new.media_gallery is distinct from old.media_gallery then
      raise exception 'Somente a equipe pode publicar mídia';
    end if;
    if new.pending_media_url is distinct from old.pending_media_url
       or new.pending_media_gallery is distinct from old.pending_media_gallery then
      new.moderation_status := 'pending';
    elsif new.moderation_status is distinct from old.moderation_status then
      new.moderation_status := old.moderation_status;
    end if;
  end if;
  return new;
end $$;