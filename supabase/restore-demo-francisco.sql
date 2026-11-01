-- restore-demo-francisco.sql
-- Recria o restaurante de demonstracao "Francisco Coffee Shop" (slug francisco-coffee).
-- Mantem o id fixo original para os links/QR continuarem validos.
-- Nao mexe em outros tenants (ex.: Anelia). Rode no SQL Editor do Supabase.

insert into public.tenants
  (id, slug, name, tagline, logo_url, bg_image_url, wifi_ssid, wifi_password, google_review_url, plan, active)
values
  (
    '11111111-1111-1111-1111-111111111111',
    'francisco-coffee',
    'Francisco Coffee Shop',
    'Café de especialidade, fermentação lenta e tempo para você.',
    '/images/logo.png',
    '/images/hero.jpg',
    'Francisco_Guest',
    'cafecomcalma2026',
    'https://www.google.com/maps',
    'signature',
    true
  )
on conflict (id) do update set
  slug = excluded.slug, name = excluded.name, tagline = excluded.tagline,
  logo_url = excluded.logo_url, bg_image_url = excluded.bg_image_url,
  wifi_ssid = excluded.wifi_ssid, wifi_password = excluded.wifi_password,
  google_review_url = excluded.google_review_url, plan = excluded.plan, active = excluded.active;

insert into public.categories (id, tenant_id, name, sort_order) values
  ('22222222-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Cafés Gelados',1),
  ('22222222-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','Matcha',2),
  ('22222222-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','Focaccias',3)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

insert into public.products
  (id, tenant_id, category_id, name, description, price_cents, media_url, media_type, modifiers, is_featured, sort_order, is_available)
values
  ('33333333-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','22222222-0000-0000-0000-000000000001',
   'Cold Brew Tonic','Cold brew extraído por 18h sobre água tônica artesanal e casca de laranja-bahia.',
   2400,'/images/coldbrew.jpg','image',
   '[{"group":"Extras","options":[{"name":"Shot Extra","price_cents":500},{"name":"Xarope de Baunilha","price_cents":300}]}]',
   true,1,true),
  ('33333333-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','22222222-0000-0000-0000-000000000002',
   'Iced Strawberry Matcha','Matcha cerimonial batido sobre purê de morango fresco e leite gelado.',
   2800,'/images/matcha.jpg','image',
   '[{"group":"Leite","options":[{"name":"Leite de Aveia","price_cents":400},{"name":"Leite de Coco","price_cents":400}]},{"group":"Extras","options":[{"name":"Dose Dupla de Matcha","price_cents":600}]}]',
   true,2,true),
  ('33333333-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','22222222-0000-0000-0000-000000000003',
   'Focaccia Mortadela & Pistache','Focaccia de fermentação natural, mortadela trufada, stracciatella e pistache tostado.',
   3900,'/images/focaccia.jpg','image',
   '[{"group":"Adicionais","options":[{"name":"Burrata Extra","price_cents":900},{"name":"Rúcula","price_cents":200}]}]',
   false,3,true),
  ('33333333-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','22222222-0000-0000-0000-000000000003',
   'Focaccia Tomate Confit','Tomates confitados no azeite, alecrim fresco e flor de sal.',
   2900,'/images/focaccia2.jpg','image',
   '[]',
   false,4,true)
on conflict (id) do update set
  name = excluded.name, description = excluded.description,
  price_cents = excluded.price_cents, media_url = excluded.media_url,
  modifiers = excluded.modifiers, is_featured = excluded.is_featured, sort_order = excluded.sort_order;

insert into public.nfc_tags (tag_code, tenant_id, table_label) values
  ('tag-001','11111111-1111-1111-1111-111111111111','01'),
  ('tag-002','11111111-1111-1111-1111-111111111111','02'),
  ('tag-003','11111111-1111-1111-1111-111111111111','04'),
  ('tag-004','11111111-1111-1111-1111-111111111111','Varanda 2')
on conflict (tag_code) do update set tenant_id = excluded.tenant_id, table_label = excluded.table_label;

select id, slug, name, active, wifi_ssid, google_review_url from public.tenants order by slug;
