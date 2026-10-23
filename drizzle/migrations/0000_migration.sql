
create type public.app_role as enum ('super_admin','user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

create policy "own roles" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'super_admin'));

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid,
  slug text unique not null,
  name text not null,
  tagline text,
  logo_url text,
  bg_image_url text,
  wifi_ssid text,
  wifi_password text,
  google_review_url text,
  plan text not null default 'essential' check (plan in ('essential','pro','signature')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select on public.tenants to anon;
grant select, insert, update, delete on public.tenants to authenticated;
grant all on public.tenants to service_role;
alter table public.tenants enable row level security;

create or replace function public.can_manage_tenant(_tenant uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select public.has_role(auth.uid(),'super_admin') or exists (select 1 from public.tenants where id=_tenant and owner_user_id = auth.uid()) $$;

create policy "public read active tenants" on public.tenants for select to anon, authenticated using (active or owner_user_id = auth.uid() or public.has_role(auth.uid(),'super_admin'));
create policy "owner update tenant" on public.tenants for update to authenticated using (owner_user_id = auth.uid() or public.has_role(auth.uid(),'super_admin'));
create policy "super insert tenant" on public.tenants for insert to authenticated with check (public.has_role(auth.uid(),'super_admin'));
create policy "super delete tenant" on public.tenants for delete to authenticated using (public.has_role(auth.uid(),'super_admin'));

create table public.nfc_tags (
  id uuid primary key default gen_random_uuid(),
  tag_code text unique not null,
  tenant_id uuid references public.tenants(id) on delete set null,
  table_label text,
  custom_redirect_url text,
  active boolean not null default true
);
grant select on public.nfc_tags to anon;
grant select, insert, update, delete on public.nfc_tags to authenticated;
grant all on public.nfc_tags to service_role;
alter table public.nfc_tags enable row level security;
create policy "public read tags" on public.nfc_tags for select to anon, authenticated using (true);
create policy "super manage tags" on public.nfc_tags for all to authenticated using (public.has_role(auth.uid(),'super_admin')) with check (public.has_role(auth.uid(),'super_admin'));

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  sort_order int not null default 0
);
grant select on public.categories to anon;
grant select, insert, update, delete on public.categories to authenticated;
grant all on public.categories to service_role;
alter table public.categories enable row level security;
create policy "public read categories" on public.categories for select to anon, authenticated using (true);
create policy "manage categories" on public.categories for all to authenticated using (public.can_manage_tenant(tenant_id)) with check (public.can_manage_tenant(tenant_id));

create table public.products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  description text check (char_length(description) <= 180),
  price_cents int not null check (price_cents > 0),
  media_url text,
  media_type text not null default 'image' check (media_type in ('image','video')),
  pending_media_url text,
  pending_media_type text,
  moderation_status text not null default 'approved' check (moderation_status in ('approved','pending','rejected')),
  modifiers jsonb not null default '[]'::jsonb,
  is_available boolean not null default true,
  is_featured boolean not null default false,
  sort_order int not null default 0
);
grant select on public.products to anon;
grant select, insert, update, delete on public.products to authenticated;
grant all on public.products to service_role;
alter table public.products enable row level security;
create policy "public read products" on public.products for select to anon, authenticated using (true);
create policy "manage products" on public.products for all to authenticated using (public.can_manage_tenant(tenant_id)) with check (public.can_manage_tenant(tenant_id));

-- owners cannot self-approve media
create or replace function public.guard_moderation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(),'super_admin') then
    if new.media_url is distinct from old.media_url or new.media_type is distinct from old.media_type then
      raise exception 'Somente a equipe pode publicar mídia';
    end if;
    if new.pending_media_url is distinct from old.pending_media_url then
      new.moderation_status := 'pending';
    elsif new.moderation_status is distinct from old.moderation_status then
      new.moderation_status := old.moderation_status;
    end if;
  end if;
  return new;
end $$;
create trigger products_guard_moderation before update on public.products for each row execute function public.guard_moderation();

create table public.telemetry_events (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  session_id uuid not null,
  table_ref text,
  event_type text not null check (event_type in ('session_start','product_view','swipe','category_change','favorite','customize_open','wifi_open','review_click','modifier_select')),
  product_id uuid references public.products(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  duration_ms int,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on public.telemetry_events (tenant_id, created_at);
grant insert on public.telemetry_events to anon;
grant select, insert on public.telemetry_events to authenticated;
grant all on public.telemetry_events to service_role;
alter table public.telemetry_events enable row level security;
create policy "anyone logs events" on public.telemetry_events for insert to anon, authenticated with check (exists (select 1 from public.tenants t where t.id = tenant_id and t.active));
create policy "owners read events" on public.telemetry_events for select to authenticated using (public.can_manage_tenant(tenant_id));

create view public.product_intelligence_view with (security_invoker = true) as
select e.product_id, e.tenant_id,
  count(*) filter (where e.event_type='product_view') as views,
  round(avg(e.duration_ms) filter (where e.event_type='product_view')/1000.0, 1) as avg_attention_s,
  count(*) filter (where e.event_type='favorite') as favorites,
  count(*) filter (where e.event_type='customize_open') as customize_opens
from public.telemetry_events e where e.product_id is not null
group by e.product_id, e.tenant_id;
grant select on public.product_intelligence_view to authenticated;

create or replace function public.product_intelligence(_tenant uuid, _days int)
returns table(product_id uuid, views bigint, avg_attention_s numeric, favorites bigint, customize_opens bigint)
language sql stable security invoker set search_path = public as $$
select e.product_id,
  count(*) filter (where e.event_type='product_view'),
  round(avg(e.duration_ms) filter (where e.event_type='product_view')/1000.0, 1),
  count(*) filter (where e.event_type='favorite'),
  count(*) filter (where e.event_type='customize_open')
from public.telemetry_events e
where e.tenant_id=_tenant and e.product_id is not null and e.created_at > now() - make_interval(days => _days)
group by e.product_id $$;

-- First user becomes super admin and owner of the demo tenant
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.user_roles where role='super_admin') then
    insert into public.user_roles(user_id, role) values (new.id, 'super_admin');
    update public.tenants set owner_user_id = new.id where slug='francisco-coffee' and owner_user_id is null;
  end if;
  insert into public.user_roles(user_id, role) values (new.id, 'user') on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Demo data
insert into public.tenants (id, slug, name, tagline, logo_url, bg_image_url, wifi_ssid, wifi_password, google_review_url, plan)
values ('11111111-1111-1111-1111-111111111111','francisco-coffee','Francisco Coffee Shop','Café de especialidade, fermentação lenta e tempo para você.','/images/logo.png','/images/hero.jpg','Francisco_Guest','cafecomcalma2026','https://www.google.com/maps','signature');

insert into public.categories (id, tenant_id, name, sort_order) values
('22222222-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Cafés Gelados',1),
('22222222-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','Matcha',2),
('22222222-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','Focaccias',3);

insert into public.products (id, tenant_id, category_id, name, description, price_cents, media_url, media_type, modifiers, is_featured, sort_order) values
('33333333-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','22222222-0000-0000-0000-000000000001','Cold Brew Tonic','Cold brew extraído por 18h sobre água tônica artesanal e casca de laranja-bahia.',2400,'/images/coldbrew.jpg','image','[{"group":"Extras","options":[{"name":"Shot Extra","price_cents":500},{"name":"Xarope de Baunilha","price_cents":300}]}]',true,1),
('33333333-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','22222222-0000-0000-0000-000000000002','Iced Strawberry Matcha','Matcha cerimonial batido sobre purê de morango fresco e leite gelado.',2800,'/images/matcha.jpg','image','[{"group":"Leite","options":[{"name":"Leite de Aveia","price_cents":400},{"name":"Leite de Coco","price_cents":400}]},{"group":"Extras","options":[{"name":"Dose Dupla de Matcha","price_cents":600}]}]',true,2),
('33333333-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','22222222-0000-0000-0000-000000000003','Focaccia Mortadela & Pistache','Focaccia de fermentação natural, mortadela trufada, stracciatella e pistache tostado.',3900,'/images/focaccia.jpg','image','[{"group":"Adicionais","options":[{"name":"Burrata Extra","price_cents":900},{"name":"Rúcula","price_cents":200}]}]',false,3),
('33333333-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','22222222-0000-0000-0000-000000000003','Focaccia Tomate Confit','Tomates confitados no azeite, alecrim fresco e flor de sal.',2900,'/images/focaccia2.jpg','image','[]',false,4);

insert into public.nfc_tags (tag_code, tenant_id, table_label) values
('tag-001','11111111-1111-1111-1111-111111111111','01'),
('tag-002','11111111-1111-1111-1111-111111111111','02'),
('tag-003','11111111-1111-1111-1111-111111111111','04'),
('tag-004','11111111-1111-1111-1111-111111111111','Varanda 2');

insert into public.telemetry_events (tenant_id, session_id, table_ref, event_type, product_id, duration_ms, created_at)
select '11111111-1111-1111-1111-111111111111', gen_random_uuid(), '04', ev, pid, dur, now() - (random()*20 || ' days')::interval
from (
  select (array['session_start','product_view','product_view','product_view','favorite','customize_open','wifi_open','review_click'])[1+floor(random()*8)::int] as ev,
         (array['33333333-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000002','33333333-0000-0000-0000-000000000003','33333333-0000-0000-0000-000000000004'])[1+floor(random()*4)::int]::uuid as p,
         g
  from generate_series(1,400) g
) s,
lateral (select case when ev in ('session_start','wifi_open','review_click') then null else p end as pid,
                case when ev='product_view' then (case when p='33333333-0000-0000-0000-000000000002' then 12000+floor(random()*15000) else 2000+floor(random()*9000) end)::int end as dur) x;
