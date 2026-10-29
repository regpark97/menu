-- fix-moderation-backfill.sql
-- Corrige SOMENTE os dados ja quebrados: produtos que ficaram com foto
-- pendente (pending_media_url) mas status 'approved'.
--
-- Por que um script separado: o trigger guard_moderation impede que o
-- moderation_status mude sem que pending_media_url tambem mude (trava de
-- seguranca contra dono auto-aprovando). Por isso o backfill precisa
-- desabilitar o trigger durante o UPDATE e reabilitar logo em seguida.

alter table public.products disable trigger products_guard_moderation;

update public.products
set moderation_status = 'pending'
where pending_media_url is not null
  and moderation_status <> 'pending';

alter table public.products enable trigger products_guard_moderation;

-- Conferencia:
select id, name, moderation_status,
       (pending_media_url is not null) as tem_foto_nova,
       (media_url is not null)          as tem_foto_publicada
from public.products
order by moderation_status, name;