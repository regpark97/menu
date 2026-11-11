# 🔍 Auditoria técnica do BUPIN — 10/11/2026

> Auditoria de segurança (RLS/SQL), código e documentação, feita sobre o commit `1e32d3b`.
> Executor: sessão de trabalho com DeepSeek Harness (Claude). Cada achado tem severidade,
> explicação e correção sugerida.

---

## Resumo executivo

| Severidade | Quantidade | Achados |
| --- | --- | --- |
| 🔴 CRÍTICA | 1 | Storage do Supabase sem isolamento por tenant |
| 🟠 ALTA | 2 | `wifi_password` legível por anônimo; `nfc_tags` expõe tudo para `anon` |
| 🟡 MÉDIA | 5 | Leads sem anti-spam no banco; telemetria sem teto de volume; listener leak; `telemetry_events` sem check de TTL; env var `SUPABASE_SERVICE_ROLE_KEY` fora do `.env.example`/docs |
| ⚪ BAIXA | 4 | `dangerouslySetInnerHTML` hardcoded; senha Wi-Fi do demo real; cobertura de testes mínima; docs desatualizados |

**Veredito geral:** arquitetura sólida. A autorização real vive no banco (RLS + triggers
`guard_moderation` + `handle_new_user` seguro), o service_role está isolado em módulo
`.server.ts` que nunca vai ao bundle do cliente, e os painéis admin/super-admin delegam
autorização ao RLS em todas as operações sensíveis. O maior furo real está nas **policies
do bucket `media` do Storage**, que não isolam tenants entre si.

---

## 🔴 CRÍTICA

### C1. Bucket `media` sem isolamento por tenant — `drizzle/migrations/0002_media_bucket.sql`

```
create policy "auth upload media" on storage.objects
  for insert to authenticated with check (bucket_id = 'media');
```

- Qualquer usuário **autenticado** (qualquer dono de restaurante, qualquer conta criada
  em `/auth`) pode dar upload/update/delete em **qualquer objeto** do bucket `media` —
  inclusive nos de outro tenant.
- O path do upload é construído no cliente (`uploadMedia(f, \`${tenant.id}/${productId}\`)`
  em `src/lib/media.ts:56-61`), mas a policy não valida o path contra o tenant do usuário.
- **Impacto:** dono do café A pode apagar/sobrescrever as fotos dos pratos do café B
  (basta conhecer o UUID do tenant, que é público no cardápio via telemetry events e via
  select em `tenants`/`products`).

**Correção sugerida** (policy por tenant via helper):

```sql
-- helper: retorna o tenant que o usuário pode gerenciar
create or replace function public.owns_storage_prefix()
returns text language sql stable security definer set search_path = public as $$
  select (select min(t.id::text) from public.tenants t
          where t.owner_user_id = auth.uid()
             or public.has_role(auth.uid(),'super_admin'))
$$;

alter policy "auth upload media" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media'
              and (storage.foldername(name))[1] = public.owns_storage_prefix());

-- repetir o padrão para update e delete (using + with check)
```

> ⚠️ Sem a policy por prefixo, um tenant malicioso pode sobrescrever a mídia de outro.
> O `Date.now()` no nome do arquivo não impede overwrite: `upload` com `upsert:false`
> falha se o path existe, mas **update/delete** direto no objeto não falha.

### C2. `nfc_tags` pública demais — `0000_migration.sql:61-62`

```
create policy "public read tags" ... using (true);
```

- Expõe a **lista completa de tags** (tag_code, tenant_id, table_label) para `anon`.
- Um concorrente pode enumerar todos os `tag_code` do sistema via API.

**Correção:** restringir leitura pública à tag consultada em `/t/:tag` via view/RPC de
lookup (o resolver já faz `.eq('tag_code', tag)`; uma RPC `resolve_tag(_code)` com
`security definer` devolve só o necessário: tenant slug + table + active).

### C3. `wifi_password` (e demais colunas de `tenants`) legíveis por `anon` — `0000_migration.sql:44`

- A policy `public read active tenants` libera `select` de **todas** as colunas para
  `anon`. O cardápio faz `select("*")` (`c.$slug.tsx:83-88`), então a senha do Wi-Fi
  de cada estabelecimento fica disponível para qualquer um com a anon key — mesmo sem
  visitar o cardápio.
- **Impacto real limitado** (a senha aparece no cardápio de qualquer forma — o recurso
  "copiar senha Wi-Fi" é a feature), mas qualquer bot/scraper pode varrer o banco e
  coletar senhas Wi-Fi + nomes + planos de todos os clientes ativos.

**Correção sugerida:**

```sql
-- 1) view pública enxuta, sem colunas sensíveis
create view public.public_tenants with (security_invoker = true) as
  select id, slug, name, tagline, logo_url, bg_image_url, google_review_url
  from public.tenants where active;
grant select on public.public_tenants to anon, authenticated;

-- 2) RPC que devolve a senha só via lookup por slug (logs/auditoria opcionais)
create or replace function public.tenant_wifi(_slug text)
returns text language sql stable security definer set search_path = public as $$
  select wifi_password from public.tenants
  where slug = _slug and active
    and (wifi_ssid is not null and wifi_password is not null)
$$;
grant execute on function public.tenant_wifi(text) to anon, authenticated;

-- 3) remover a policy "public read active tenants" ou restringir as colunas
```

> Se o "Conectar ao Wi-Fi" do cardápio copiar a senha via RPC sob demanda (clicou →
> chamou a RPC), o `select *` atual desaparece do tráfego.

---

## 🟡 MÉDIA

### M1. `leads` sem anti-spam no banco — `0006_leads.sql:19-22`

- Insert público com `with check (true)`. A validação é só no cliente. Um bot pode
  encher a tabela de lixo e poluir o funil do Super Admin.
- **Correção:** RPC `submit_lead(...)` com `security definer` e checagem simples de
  rate limit (ex: máx 5 inserts por IP/hora usando `request.headers` não dá em SQL;
  alternativa: máx N leads por e-mail/dia + validação de tamanho). Honeypot no form
  também ajuda.

### M2. Telemetria sem teto de volume — `telemetry.ts` + `0000_migration.sql:136`

- A policy de insert para anon só exige tenant ativo — sem limite de eventos por
  sessão/hora. Um script malicioso pode gerar milhões de linhas (`telemetry_events`
  já tem 400 linhas demo... e não tem partição nem TTL).
- **Correção:** limitar batch no `flush()` (já limita a 1 retry, ok), adicionar TTL
  (cron de purge > 90 dias) e um check de sanidade na RPC de inserção se migrar para
  RPC. Também vale indexar `(session_id)` se as métricas v2 crescerem.

### M3. Listener leak em `initTelemetry` — `telemetry.ts:77-80`

- `document.addEventListener("visibilitychange", ...)` é adicionado dentro do `if (!timer)`
  mas nunca removido; em navegações client-side entre cardápios o listener persiste (ok,
  pois o módulo é singleton), porém o listener chama `flush()` mesmo após unmount das
  rotas — inofensivo (fila vazia) mas é um vazamento de referência a funções antigas.
- **Correção:** extrair handler para variável nomeada e registrar uma vez no módulo.

### M4. `SUPABASE_SERVICE_ROLE_KEY` ausente do `.env.example` e docs de env — `client.server.ts:37`

- O módulo `.server.ts` lê `SUPABASE_SERVICE_ROLE_KEY`, mas `.env.example` e
  `docs/DEPLOY.md` só documentam as 6 variáveis publishable. Quem rodar o server em
  local/Vercel sem cadastrar essa variável terá erro 500 silencioso no primeiro uso
  do `supabaseAdmin`.
- **Correção:** adicionar entrada comentada no `.env.example` + seção em DEPLOY.md.

### M5. `.env.example` desatualizado em relação ao código

- Chama o projeto de "SipFlow" e não menciona a nova convenção de pastas do storage
  (`{tenantId}/{productId}`, `logo|bg`, `gallery`) nem `SUPABASE_SERVICE_ROLE_KEY`
  (ver M4). Docs de env espalhados entre `.env.example`, HANDOFF seção 4.3 e DEPLOY.md
  com pequenas divergências (HANDOFF lista 6 vars; o código lê 7 no server).

---

## ⚪ BAIXA

### B1. `dangerouslySetInnerHTML` — `index.tsx:647`

- `lab` vem de array estático hardcoded (`"Taco de<br>Asada"`), sem input de usuário.
  Sem risco hoje, mas é code smell; trocar por `{"Taco de Asada".split("<br>")}` ou
  usar duas linhas estilizadas.

### B2. Senha Wi-Fi do demo — `0000_migration.sql:176`

- `cafecomcalma2026` e SSID `Francisco_Guest`: se o café real usa essas credenciais
  no roteador, estão públicas para sempre (a migration está no GitHub público).
  Verificar com o estabelecimento se é senha real; se sim, trocar no roteador e no banco.

### B3. Cobertura de testes mínima

- Apenas `src/test/app-routing.test.tsx` (1 teste). admin.tsx (1196 linhas),
  super-admin.tsx (662), c.$slug.tsx (625) sem cobertura. Sem CI de testes (não há
  workflow do GitHub Actions).

### B4. Docs com divergências

- `docs/SUPABASE.md` documenta migrations apenas até `0002`; não cobre `0003` (galeria),
  `0004` (waiter_calls), `0005` (métricas v2), `0006` (leads), `0007` (fix trigger).
- HANDOFF seção 3/9 descreve linhas/contagens antigas ("super-admin 606 linhas" — hoje 662;
  "admin 753" — hoje 1196).
- `AGENTS.md` avisa sobre Lovable, ok. `README.md` raiz atualizado hoje, ok.
- Falta doc de **backup/restore** e de **resposta a incidentes** (ex: senha vazada, tag
  clonada em massa, spam de leads).

---

## ✅ Pontos fortes confirmados

1. **Service role isolado** em `client.server.ts` com Proxy lazy + comentário de
   segurança explícito — não vai ao bundle do cliente.
2. **Moderação de mídia** com trigger `guard_moderation` no banco — o dono não consegue
   publicar mídia sem aprovação mesmo manipulando o cliente.
3. **`handle_new_user` seguro** (0007): sem auto-promoção; super admin só manualmente.
4. **Isolamento tenant em RLS** consistente em `categories/products/telemetry_events/
   waiter_calls` via `can_manage_tenant()`.
5. **RPCs** `call_waiter` e `user_id_by_email` com `security definer`, `search_path`
   fixado e validação de permissão explícita.
6. **Upload de mídia** com validação de tipo/tamanho no cliente antes de gastar banda
   (10MB img / 25MB vídeo) + bucket com 50MB e MIME whitelist.
7. **Form de leads** com validação, máscara de telefone e estados de loading/erro.
8. **`auth-middleware.ts`** valida token JWT com `getClaims` antes de qualquer server
   function.

---

## Plano de ação sugerido (ordem)

1. 🔴 **C1 storage por tenant** — corrigir policies do bucket `media` (migration 0008).
2. 🔴 **C2/C3** — view pública enxuga `tenants` + RPC `tenant_wifi`; RPC `resolve_tag`.
3. 🟡 **M1** — RPC de lead com rate limit simples.
4. 🟡 **M4/M5** — completar `.env.example` (service role) e alinhar docs de env.
5. 🟡 **M2/M3** — TTL de telemetria + listener fix.
6. ⚪ **B2** — trocar a senha do demo (se real) e documentar no HANDOFF.
7. ⚪ **B4** — atualizar `docs/SUPABASE.md` com migrations 0003-0007 + seção backup/incidente.
