# 🔐 SUPABASE — Schema, Segurança, RLS e RPCs

> Referência técnica do banco. Projeto: `ulxndzniyeyracujqmlu`
> Dashboard: https://supabase.com/dashboard/project/ulxndzniyeyracujqmlu

---

## 1. Tabelas

Todas vivem no schema `public` e **todas têm RLS ativado**.

| Tabela             | Papel                                                        |
| ------------------ | ------------------------------------------------------------ |
| `user_roles`       | Papéis (`super_admin`, `user`) por `user_id`                 |
| `tenants`          | Estabelecimentos (o "cliente" no vocabulário do Super Admin) |
| `nfc_tags`         | Cartões NFC físicos, com `tag_code` gravado na tag           |
| `categories`       | Categorias do cardápio (por tenant)                          |
| `products`         | Pratos (por tenant, com `category_id`)                       |
| `telemetry_events` | Telemetria de atenção por prato                              |
| `storage.buckets`  | Bucket `media` (privado) para fotos/vídeos                   |

### Colunas relevantes

**`tenants`**

```
id                uuid pk default gen_random_uuid()
owner_user_id     uuid  null  →  auth.users(id)   -- vínculo com a pessoa
slug              text  unique                     -- ex.: "francisco-porto"
name              text
tagline           text
logo_url          text
bg_image_url      text
wifi_ssid         text
wifi_password     text
google_review_url text
plan              text  ('essential' | 'pro' | 'signature')
active            boolean default true
created_at        timestamptz default now()
```

**`nfc_tags`**

```
id                  uuid pk
tag_code            text unique   -- gravado fisicamente na tag
tenant_id           uuid null → tenants(id) on delete set null
table_label         text          -- "04", "Varanda 2"
custom_redirect_url text null     -- se preenchido, ignora o cardápio
active              boolean default true

---

## 2. Funções do banco

| Função                                          | Tipo                             | Papel                                       |
| ----------------------------------------------- | -------------------------------- | ------------------------------------------- |
| `has_role(_user_id uuid, _role app_role)`       | SQL, `SECURITY DEFINER`, `stable` | Verifica se o usuário tem o papel           |
| `can_manage_tenant(_tenant uuid)`               | SQL, `SECURITY DEFINER`, `stable` | `super_admin` **ou** dono do tenant         |
| `handle_new_user()`                             | Trigger, `SECURITY DEFINER`      | Cria `user_roles` no cadastro               |
| `guard_moderation()`                            | Trigger, `SECURITY DEFINER`      | Protege campos de moderação                 |
| `product_intelligence(_tenant uuid, _days int)` | SQL                              | Métricas de atenção por prato               |
| `user_id_by_email(_email text)`                 | PL/pgSQL, `SECURITY DEFINER`     | **Adicionada no hardening.** E-mail → UUID  |

### Por que `SECURITY DEFINER` é obrigatório aqui

As funções leem coisas que o cliente (com a chave `anon`/`publishable`) **não pode** ler:

- `has_role` e `can_manage_tenant` → leem `user_roles`/`tenants` **dentro de policies**.
  Uma policy que chama uma função que lê a própria tabela protegida causaria recursão
  infinita se não fosse `SECURITY DEFINER`.
- `user_id_by_email` → lê `auth.users`, que **nunca** é exposto pelo schema público.

Todas usam `set search_path = public` — sem isso, um atacante poderia sequestrar a
resolução de nomes criando um schema malicioso.

---

## 3. Políticas RLS — o estado final

### `tenants`

| Policy                       | Para          | Regra                                                              |
| ---------------------------- | ------------- | ------------------------------------------------------------------ |
| `public read active tenants` | anon, auth    | `active` **ou** `owner_user_id = auth.uid()` **ou** `super_admin`  |
| `owner update tenant`        | authenticated | `owner_user_id = auth.uid()` ou `super_admin`                      |
| `super insert tenant`        | authenticated | só `super_admin`                                                   |
| `super delete tenant`        | authenticated | só `super_admin`                                                   |

> ✅ O `active` sozinho na primeira policy é o que faz a rota `/t/<tag>` funcionar: o
> app faz `select("..., tenants(slug)")` como anônimo, e o join exige poder ler
> `tenants.slug`. **Já validado em produção** (`/t/tag-001` → HTTP 200).

### `nfc_tags`

| Policy              | Para          | Regra                                     |
| ------------------- | ------------- | ----------------------------------------- |
| `public read tags`  | anon, auth    | `using (true)` — leitura totalmente aberta |
| `super manage tags` | authenticated | leitura/escrita só para `super_admin`     |

### `categories` / `products`

| Policy          | Para          | Regra                                 |
| --------------- | ------------- | ------------------------------------- |
| `public read …` | anon, auth    | `using (true)` — o cardápio é público  |
| `manage …`      | authenticated | `public.can_manage_tenant(tenant_id)` |

### `telemetry_events`

| Policy               | Para          | Regra                                                     |
| -------------------- | ------------- | --------------------------------------------------------- |
| `anyone logs events` | anon, auth    | INSERT permitido se o tenant existir e estiver `active`   |
| `owners read events` | authenticated | SELECT se `can_manage_tenant(tenant_id)`                  |

```

> O `on delete set null` é importante: excluir um cliente **não** apaga as tags

### `user_roles` — ⚠️ o furo que foi fechado

**Antes** (perigoso): RLS ativado + `GRANT` para `authenticated`, mas **nenhuma policy**.
No Postgres, tabela com RLS ativo e **zero policies** libera **tudo** para os papéis com
privilégio concedido. Resultado: **qualquer usuário logado inseria
`(auth.uid(), 'super_admin')` em `user_roles` e virava Super Admin do sistema.**

**Depois** (`hardening.sql`):

```sql
drop policy if exists "own roles" on public.user_roles;
create policy "read own roles" on public.user_roles
  for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'super_admin'));

revoke insert, update, delete on public.user_roles from authenticated, anon;
```

Agora só existe **SELECT** (o próprio registro, ou tudo se for `super_admin`). Escrita
apenas via `service_role`. O app **não** escreve nessa tabela — a concessão de super
admin é manual por SQL.

---

## 4. Trigger `handle_new_user` — a outra correção

**Antes:** o primeiro usuário cadastrado no sistema era **automaticamente** promovido
a `super_admin`. Problema: é um "primeiro cadastrado manda". Se aquela conta for
apagada algum dia, o próximo estranho que se cadastrar herda o sistema inteiro.

**Depois** (`hardening.sql`):

```sql
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_roles (user_id, role)
  values (new.id, 'user')          -- SEMPRE 'user'. Nunca 'super_admin'.
  on conflict do nothing;
  return new;
end $$;
```

Para virar Super Admin: SQL manual (ver `HANDOFF.md` seção 8).

---

## 5. A RPC `user_id_by_email` (vínculo de dono por e-mail)

Arquivo: `supabase/rpc-user-lookup.sql` — **já rodado em produção**.

```sql
create or replace function public.user_id_by_email(_email text)
returns uuid
language plpgsql stable security definer
set search_path = public, auth
as $$
declare
  _id uuid;
begin
  if not public.has_role(auth.uid(), 'super_admin') then
    raise exception 'Acesso restrito à equipe SipFlow';
  end if;

  select id into _id
  from auth.users
  where lower(email) = lower(trim(_email))
  limit 1;

  return _id;  -- null se não existir
end $$;

revoke all on function public.user_id_by_email(text) from public, anon;
grant execute on function public.user_id_by_email(text) to authenticated;
```

**Por que existe:** `auth.users` **não** é acessível pelo cliente (nem para
super_admin). Para vincular um estabelecimento a uma pessoa sem pedir que ela copie
o UUID, o Super Admin digita o e-mail e esta função traduz.

**Comportamento:**

| Situação                  | Resultado                                              |
| ------------------------- | ------------------------------------------------------ |
| Chamador não é super_admin | exceção `Acesso restrito à equipe SipFlow`             |
| E-mail não existe          | retorna `null` (o front mostra aviso amarelo de 8s)    |
| E-mail existe              | retorna o UUID (o front vincula)                       |
| Maiúsculas/espaços         | tolerado por `lower(trim(...))`                        |

> ⚠️ **Efeito colateral conhecido:** se o e-mail tiver **um dígito a menos** (ex.:
> `costaanaercilia@gmail.com` vs `costaanaercilia984@gmail.com`), a função retorna
> `null` **sem erro nenhum**. O único sinal é um aviso amarelo de 8 segundos, fácil de
> perder. Foi exatamente o que causou o cadastro órfão da Ana Célia.


---

## 6. Storage — bucket `media`

Arquivo: `drizzle/migrations/0002_media_bucket.sql`.

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media','media', false, 52428800, array[...])
on conflict (id) do update set ...;
```

| Propriedade    | Valor                                                          |
| -------------- | -------------------------------------------------------------- |
| Bucket         | `media`, **privado**                                            |
| Tamanho máximo | 50 MB                                                           |
| Formatos       | png, jpeg, jpg, webp, gif, avif, svg+xml, mp4, webm, quicktime   |
| Leitura        | `public read public media` → `bucket_id = 'media'` para anon/auth |

> **Bug corrigido:** a migração `0001` criava apenas **policies** do bucket, mas o
> **bucket em si nunca tinha sido criado** — então todo upload falhava. A `0002`
> conserta isso e adiciona as policies de `DELETE`/`UPDATE` que faltavam (sem elas, o
> dono não conseguia **substituir** a foto de um prato).

---

## 7. Como reaplicar os SQLs do zero (num projeto Supabase novo)

Ordem **importante**:

```
1. Migração base ......... node migrate-to-own-supabase.mjs
                           (ou aplique drizzle/migrations/0000 + 0001 + 0002)
2. supabase/hardening.sql  segurança (RLS de user_roles + trigger)
3. supabase/rpc-user-lookup.sql  RPC de busca por e-mail
4. Conceda super_admin ......... insert em user_roles (HANDOFF.md seção 8)
```

Passos 2 e 3 são **idempotentes** (`drop … if exists` + `create or replace`) — pode
rodar de novo sem medo.

### Onde rodar

```
Supabase → SQL Editor → New query → colar → Run
```

Confira depois:

| O que checar        | Onde                                                                       |
| ------------------- | -------------------------------------------------------------------------- |
| `user_id_by_email`  | Database → Functions (tipo "function", retorno `uuid`, marcado **Definer**) |
| RLS de `user_roles` | Authentication → Policies (só policies de SELECT)                          |
| Trigger             | Database → Triggers (`on_auth_user_created`)                               |

---

## 8. Modelo mental: duas entidades, nenhuma "aprovação"

Isto confunde e vale fixar:

```
/auth  (cadastro do usuário)
   └─→ cria linha em auth.users + user_roles(role='user')
       └─→ ❌ NADA aparece no Super Admin

/super-admin  (você cria o cliente)
   └─→ cria linha em tenants (o estabelecimento)
       └─→ ✅ aparece na lista "Clientes"

O VÍNCULO
   tenants.owner_user_id  ==  auth.users.id
   └─→ feito por: criação com e-mail (auto) ou botão "Vincular dono"
```

**Não existe conceito de "aprovar usuário".** Não existe fila de pendentes. Se alguém
se cadastrou e nada apareceu, é porque ainda não tem estabelecimento — isso é o
comportamento projetado, não um bug. (Ver melhoria opcional 4.5 do `HANDOFF.md`.)

---

## 9. Regra fundamental do Postgres que causou o furo

> **RLS ativado + zero policies = tabela liberada** (para papéis com `GRANT`).

Muita gente acredita no contrário. O padrão seguro é:

1. `alter table … enable row level security`
2. `revoke` os privilégios amplos que o Supabase concede por padrão
3. Criar **policies explícitas** para cada operação necessária

Se você criar uma tabela nova e só ativar RLS, ela está **aberta**.

> físicas, apenas as desvincula (elas voltam a poder ser reutilizadas).
