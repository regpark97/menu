# 📜 HISTÓRICO — O que foi feito, quando e por quê

> Linha do tempo técnica. Útil para entender **por que** certas escolhas foram tomadas
> e para não repetir investigações já feitas.

---

## Fase 1 — Projeto original no Lovable

O SipFlow nasceu dentro do **Lovable**, com Supabase gerenciado pela própria plataforma
(projeto `nlbmrbcvpvkmikyvfuur`, hoje abandonado).

**Sintomas da época:**

- Bucket de fotos `media` **nunca existiu** — só as policies. Todo upload falhava.
- Banco de dados fora do controle do usuário (sem backup próprio).
- Deploy preso ao domínio `menu-tau-bice.vercel.app`.

---

## Fase 2 — Migração para Supabase próprio

**Objetivo:** sair do banco do Lovable e ter um projeto Supabase **próprio**, com
backup sob controle.

### O que foi criado

| Artefato                        | Papel                                                        |
| ------------------------------- | ------------------------------------------------------------ |
| `migrate-to-own-supabase.mjs`   | Script Node que recria o schema no projeto novo               |
| `MIGRACAO-SUPABASE.md`          | Guia passo a passo (criar projeto, pegar chaves, rodar SQL)   |

### Novo projeto

```
Supabase Project ID: ulxndzniyeyracujqmlu
```

### Migrações do schema

| Arquivo                                    | O que faz                                                                     |
| ------------------------------------------ | ----------------------------------------------------------------------------- |
| `drizzle/migrations/0000_migration.sql`    | Tabelas, RLS, funções (`has_role`, `can_manage_tenant`, triggers), dados demo |
| `drizzle/migrations/0001_migration.sql`    | Policies do Storage (bucket `media`)                                          |
| `drizzle/migrations/0002_media_bucket.sql` | **Cria o bucket `media` de fato** + policies de DELETE/UPDATE                 |


---

## Fase 3 — Revisão de segurança

### 🔴 Furo 1 — Auto-promoção a Super Admin

**O que estava errado:** a tabela `user_roles` tinha RLS **ativado**, `GRANT` para
`authenticated`, e **nenhuma policy de escrita**. Confiando na intuição ("RLS ativo =
protegido"), parecia seguro. **Não é.**

No Postgres, quando uma tabela tem RLS ativo mas **zero policies**, as operações que
têm `GRANT` para aquele papel ficam **liberadas**. O efeito prático:

```js
// Qualquer usuário logado, do console do navegador:
supabase.from('user_roles').insert({ user_id: <próprio id>, role: 'super_admin' })
// → virava Super Admin do sistema inteiro
```

**Como era explorável:** a chave `publishable` está no bundle do front, visível a
qualquer visitante. Bastava criar uma conta em `/auth` e rodar o insert.

**Correção** (`supabase/hardening.sql`):

```sql
drop policy if exists "own roles" on public.user_roles;
create policy "read own roles" on public.user_roles
  for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'super_admin'));

revoke insert, update, delete on public.user_roles from authenticated, anon;
```

### 🔴 Furo 2 — "Primeiro cadastrado manda"

**O que estava errado:** o trigger `handle_new_user` promovia o **primeiro** usuário
cadastrado no sistema a `super_admin` automaticamente.

**Por que é perigoso:** se aquela conta for apagada algum dia, o **próximo estranho**
que se cadastrar herda o sistema. Não há verificação, não há aviso.

**Correção:** todo novo usuário entra **sempre** como `'user'`. Super Admin só por SQL
manual.

### 🟡 Endurecimento adicional

- `hardening.sql` inclui, comentado, o bloco que restringe o cardápio público a
  estabelecimentos com `active = true` (útil se um dia for preciso esconder clientes
  desativados).
- As funções críticas já usavam `SECURITY DEFINER` + `set search_path = public` — isso
  foi mantido e verificado.

**Status:** ✅ `hardening.sql` rodado e verificado no Supabase.

---

## Fase 4 — Vínculo de dono por e-mail ("Modelo A")

### O problema

`auth.users` **não** é acessível pelo cliente Supabase — nem para `super_admin`. Para
vincular um estabelecimento a uma pessoa, a única via era pedir o **UUID** dela, o que
é impraticável no atendimento.

### A solução

`supabase/rpc-user-lookup.sql`:

```sql
create or replace function public.user_id_by_email(_email text)
returns uuid
language plpgsql stable security definer
set search_path = public, auth
as $$
declare _id uuid;
begin
  if not public.has_role(auth.uid(), 'super_admin') then
    raise exception 'Acesso restrito à equipe SipFlow';
  end if;

  select id into _id from auth.users
  where lower(email) = lower(trim(_email)) limit 1;

  return _id;
end $$;

revoke all on function public.user_id_by_email(text) from public, anon;
grant execute on function public.user_id_by_email(text) to authenticated;
```

**Três camadas de proteção:**

1. `SECURITY DEFINER` → consegue ler `auth.users`.
2. Trava explícita de papel dentro da função → não basta ter a chave pública.
3. `revoke` de `public`/`anon` + `grant` só para `authenticated` → anônimo nem chega.

**Status:** ✅ rodado. Confirmado em `Database → Functions` (retorno `uuid`, marcado
**Definer**).

> 🐞 **Bug corrigido na 0002:** a `0001` só criava **policies** de um bucket que **não
> existia**. Por isso o upload de fotos de prato falhava em produção.

### Dados de demonstração migrados

- 1 estabelecimento: _Francisco Coffee Shop_ (slug `francisco-porto`)
- 3 categorias
- 4 pratos
- 4 tags NFC (`tag-001` … `tag-004`)

---

## Fase 5 — Botões novos no Super Admin

Implementados em `src/routes/_authenticated/super-admin.tsx` (606 linhas):

| Botão               | Linha aprox. | Comportamento                                                 |
| ------------------- | ------------ | ------------------------------------------------------------- |
| **Criar cliente**   | 85–123       | Cria o tenant e, se o e-mail tiver conta, **vincula na hora**  |
| **Vincular dono**   | 192–216      | Chama a RPC por e-mail                                         |
| **Trocar dono**     | 326          | Mesmo fluxo, com dono já existente                             |
| **Desvincular**     | 219–224      | Zera `owner_user_id`                                           |
| **Excluir cliente** | 226–250      | Apaga o tenant; tags NFC ficam órfãs (`on delete set null`)    |

**Detalhes de UX que importam:**

- Sucesso com vínculo → mensagem **verde**: `"Estabelecimento criado e vinculado a <email>"`.
- E-mail sem conta → aviso **amarelo** de 8 segundos: `"<email> ainda não tem conta:
  peça para se cadastrar em /auth"`.
- Exclusão com dono → aviso explícito de que a pessoa **perde o acesso na hora**.

> ⚠️ **A origem do problema da Ana Célia:** o aviso amarelo dura só 8s. Se o e-mail
> digitado tiver **um dígito errado**, a RPC retorna `null`, o tenant é criado **sem
> dono**, e o aviso passa despercebido. O resultado é um estabelecimento **órfão** —
> existe, está na lista, mas ninguém consegue administrá-lo.

---

## Fase 6 — A saga do deploy travado (≈20 horas)

### Sintoma

Todo `git push` gerava um deploy na Vercel marcado como **`Blocked`**. Ficava assim por
quase 20 horas e depois sumia. Nenhuma build, nenhum erro visível.

### Investigação (o que foi testado e descartado)

| Hipótese                              | Teste                                | Resultado    |
| ------------------------------------- | ------------------------------------ | ------------ |
| `vercel.json` com `framework: null`   | Removi o campo                       | ❌ não era   |
| `.gitignore` desatualizado            | Limpei entradas obsoletas            | ❌ não era   |
| Configuração do projeto na Vercel     | Revisei build command e root dir     | ❌ não era   |
| Permissões / integração GitHub        | Repositório estava acessível         | ❌ não era   |

### 🎯 A causa real

Os 6 commits do repositório tinham o autor:

```
SipFlow <sipflow@local.dev>
```

Um e-mail **não vinculado a nenhuma conta Git** (nem GitHub, nem Vercel). A Vercel
**recusa construir** commits cujo autor ela não consegue atribuir — silenciosamente,
marcando como `Blocked`.

### A correção

```powershell
# 1. Diagnóstico
git log -5 --pretty=format:'%h | %an <%ae> | %s'

# 2. Backup antes de reescrever histórico
git branch backup-pre-rewrite

# 3. Reescrever autor de todos os commits
git filter-branch --env-filter '
  export GIT_AUTHOR_NAME="regpark97"
  export GIT_AUTHOR_EMAIL="lilomitofwdase@gmail.com"
  export GIT_COMMITTER_NAME="regpark97"
  export GIT_COMMITTER_EMAIL="lilomitofwdase@gmail.com"
' -- --all

# 4. Enviar
git push --force-with-lease origin main
```

### Resultado

| Antes                        | Depois                       |
| ---------------------------- | ---------------------------- |
| Deploy `Blocked` por ~20h    | Deploy `READY` em **26s**    |
| `a03d75f → ea91d9d`          | `2279729` (atual)            |
| branch `backup-pre-rewrite`  | preservado, por segurança    |

> 🛡️ **Prevenção:** `git config user.name/user.email` **antes** de qualquer commit em
> máquina nova. Ver `HANDOFF.md` seção 5.

---

## Fase 7 — Segundo bloqueador: `ssoProtection`

Depois do deploy passar, o site **ainda** não abria para o público: qualquer visita
pedia login da Vercel.

### Diagnóstico

Consulta à API da Vercel (`GET /v9/projects/menu`) revelou:

```json
"ssoProtection": { "deploymentType": "all" }
```

Essa é a **Vercel Authentication** (Deployment Protection), ativada por padrão em
alguns fluxos de criação de projeto.

### Por que era crítico

Os cartões NFC dos clientes apontam para a URL do site. Com essa proteção ligada,
**todos os NFC parariam** — o cliente veria uma tela de login da Vercel em vez do
cardápio, e ninguém entenderia por quê.

### Correção

```powershell
curl.exe -s -X PATCH `
  -H "Authorization: Bearer $env:VERCEL_TOKEN" `
  -H "Content-Type: application/json" `
  -d '{"ssoProtection":null}' `
  "https://api.vercel.com/v9/projects/menu?teamId=team_g6f4ZR3TiKUhzKG5MNXNoW3B"
```

### Verificação

| Rota          | Antes      | Depois   |
| ------------- | ---------- | -------- |
| `/`           | 🔒 login   | ✅ 200   |
| `/auth`       | 🔒 login   | ✅ 200   |
| `/super-admin`| 🔒 login   | ✅ 200   |
| `/t/tag-001`  | 🔒 login   | ✅ 200   |

> 🔔 **Vigiar sempre.** Se voltar a ligar, todos os NFC param.


---

## Fase 8 — Correções menores

### 8.1 `supabase/config.toml` apontava para o projeto errado

```toml
# antes
project_id = "nlbmrbcvpvkmikyvfuur"   # projeto antigo, abandonado

# depois
project_id = "ulxndzniyeyracujqmlu"   # projeto real
```

**Por que importava:** um `supabase link` ou `supabase db push` teria aplicado mudanças
**no banco errado**, sem nenhum aviso.

Commit: `2279729 fix(supabase): corrige project_id do config.toml para o projeto real`.

### 8.2 Bucket `media` (upload de fotos)

Já descrito na Fase 2 — a `0002_media_bucket.sql` criou o bucket que faltava e as
policies de `DELETE`/`UPDATE` (sem elas, o dono não conseguia **substituir** a foto de
um prato, só adicionar).

### 8.3 `.gitignore`

Revisado para garantir que **nunca** vão para o Git:

```
.env
.env.*
!.env.example
.vercel
dist
.output
*.log
tmp-*
```

**Verificado:** apenas `.env.example` está versionado. Nenhuma chave secreta no
repositório.

---

## Fase 9 — O caso Ana Célia (cadastro órfão): investigação

### O relato

A Ana Célia se cadastrou, você criou o estabelecimento dela, mas ela não via o painel.

### O diagnóstico

Havia **duas** contas, com e-mails que diferem por **um dígito**:

```
❌ costaanaercilia@gmail.com      ← usado ao criar o estabelecimento
✅ costaanaercilia984@gmail.com   ← a conta que ela realmente criou
```

A RPC `user_id_by_email` usa comparação **exata**:

```sql
where lower(email) = lower(trim(_email))
```

Como `costaanaercilia@gmail.com` ≠ `costaanaercilia984@gmail.com`, a função retornou
`null` — **sem erro**. O front mostrou o aviso amarelo por 8 segundos (fácil de perder),
e o estabelecimento foi criado **sem dono**.

### Por que é difícil de perceber

1. Nenhum erro é lançado — a RPC retorna `null` silenciosamente.
2. O aviso amarelo desaparece em 8 segundos.
3. O estabelecimento **aparece normalmente** na lista do Super Admin (parece OK).
4. Do lado da Ana Célia, ela loga e não vê nada — parece bug do sistema.
5. O sistema **não tem** (hoje) uma visão de "usuários sem estabelecimento" que
   revelaria o problema.

### A resolução

1. ✅ A conta órfã (`costaanaercilia@gmail.com`, sem o `984`) foi **apagada** no
   Supabase → Authentication → Users.
2. ⏳ **Pendente:** re-criar a conta da Ana Célia com o e-mail **correto**
   (`costaanaercilia984@gmail.com`) e refazer o vínculo pelo Caminho B
   (ver `docs/OPERACAO.md` seção 2.1).

### A lição

**Ordem importa menos do que a exatidão do e-mail.** O Caminho B (a pessoa se cadastra
primeiro) é superior porque o vínculo acontece automaticamente durante a criação do
cliente — mas só funciona se o e-mail for **idêntico ao caractere**.

### Melhoria proposta (não implementada)

Uma aba **"Usuários"** no Super Admin, listando `auth.users` com filtro
**"sem estabelecimento"**. Isso tornaria o problema **visível** em vez de silencioso.
Ver `HANDOFF.md` seção 4.5.


---

## Fase 10 — Auditoria final (validação de que tudo funciona)

Executada no commit `2279729`:

| Verificação                          | Comando                                    | Resultado  |
| ------------------------------------ | ------------------------------------------ | ---------- |
| Tipos TypeScript                     | `npx tsc --noEmit`                         | ✅ EXIT 0  |
| Testes unitários                     | `npx vitest run`                           | ✅ passed  |
| Lint                                 | `npx eslint .`                             | ✅ limpo   |
| `.env` fora do Git                   | `git ls-files` filtrando `.env`            | ✅ só `.env.example` |
| Site público                         | `curl -L` em `/`, `/auth`, `/super-admin`  | ✅ 200     |
| Rota NFC                             | `curl -L /t/tag-001`                       | ✅ 200     |
| Features no bundle                   | grep no chunk de produção                  | ✅ `Excluir cliente`, `Vincular dono`, `Trocar dono`, `user_id_by_email` |
| `hardening.sql` rodado               | Supabase → Policies                        | ✅         |
| `rpc-user-lookup.sql` rodado         | Supabase → Functions                       | ✅         |
| Git limpo e sincronizado             | `git status` / `rev-parse HEAD`            | ✅ local = remote = `2279729` |

### Sobre o "suspeito" da rota `/t/<tag>` — hipótese descartada

Durante a auditoria, foi levantada a hipótese de um **bug de RLS**: a query em
`src/routes/t.$tag.tsx:28-32` faz

```js
.select("custom_redirect_url, table_label, active, tenants(slug)")
```

O join `tenants(slug)` exigiria que `tenants` fosse legível por `anon`. A hipótese era
que só `nfc_tags` tinha policy pública, e que o join quebraria.

**A hipótese foi DESCARTADA.** A policy existe:

```sql
create policy "public read active tenants" on public.tenants
  for select to anon, authenticated
  using (active or owner_user_id = auth.uid() or public.has_role(auth.uid(),'super_admin'));
```

O `active` sozinho libera a leitura pública. **Confirmado ao vivo:** `/t/tag-001` →
**HTTP 200**. Nenhuma correção de RLS é necessária aqui.

---

## Resumo dos commits

| Hash      | Mensagem                                                                 |
| --------- | ------------------------------------------------------------------------ |
| `2279729` | fix(supabase): corrige project_id do config.toml para o projeto real     |
| `ea91d9d` | fix(deploy): remove framework:null do vercel.json e limpa .gitignore      |
| `e12bb86` | feat(super-admin): botao para excluir cliente com confirmacao             |
| `74dfd03` | Seguranca: fecha auto-promocao a super_admin + vinculo de dono por e-mail |
| `9cf37e0` | feat(admin): fallback de Super Admin e criacao de categoria no dialogo    |
| `2297dba` | fix(auth): esconde botao do Google fora do dominio Lovable                |
| `7bba798` | Migracao para Supabase proprio + deploy Vercel                            |

> ℹ️ Os commits foram **reescritos** (Fase 6) para corrigir o autor. Os hashes acima
> são os **pós-reescrita**.
>
> 🌿 Branch de segurança preservado: **`backup-pre-rewrite`**.

---

## Pendências conhecidas (resumo)

| # | Pendência                                            | Prioridade | Onde resolver                     |
| - | ---------------------------------------------------- | ---------- | --------------------------------- |
| 1 | Resetar a senha do Postgres                          | 🔴 alta    | Supabase → Settings → Database    |
| 2 | Configurar Auth → URL Configuration                  | 🟡 média   | Supabase → Authentication         |
| 3 | Conferir as 6 env vars na Vercel                     | 🟡 média   | Vercel → Settings → Environment   |
| 4 | Re-criar a conta da Ana Célia e vincular             | 🟡 média   | `/auth` + `/super-admin`          |
| 5 | Implementar aba "Usuários" no Super Admin (opcional) | 🟢 baixa   | `super-admin.tsx` + nova RPC      |
| 6 | Apagar `tmp-deploy*.log` se ainda existirem          | 🟢 baixa   | raiz do projeto                   |

---

## Fase 11 — Fix mobile da landing page (11/11/2026)

**Contexto:** usuário reportou a LP mal formatada no celular, mesmo depois dos fixes
da noite de 10/11 (`c2a2145` e `5b254e4`). Análise do CSS revelou 5 bugs restantes.

**Descoberta principal:** o `5b254e4` (fix do logo/nav mobile) **regrediu** o commit
anterior `c2a2145` — ao editar o bloco `@media (max-width: 640px)`, as regras de
tipografia (`h2` clamp, paddings do price-card/filters) foram substituídas em vez de
mantidas. Por isso a página continuava "gigante" no celular.

| Fix | Detalhe |
| --- | --- |
| Tipografia restaurada | `h2 { clamp(26px, 7.2vw, 32px) }`, paddings do price-card/lead-form/filters — regras perdidas da regressão |
| Pílulas do mockup | `flex-wrap: wrap` na `.blp-topbar` — antes vazavam do celular de 300px |
| Zoom do iOS | inputs/select com 16px no mobile (Safari da zoom automático abaixo disso) |
| Mockup fluido | `width: min(300px, 100vw - 88px)` — não estoura nem em iPhone SE (320px) |
| Âncoras | `scroll-margin-top: 76px` — a nav fixa cobria os títulos das seções |

**Commit:** `d87c7de` (`fix(lp): restaura tipografia mobile perdida + fixes iOS, mockup e ancoras`) —
autor `regpark97` ✅. Build validado (vite + vitest 3/3), deploy confirmado em produção
pelo hash do CSS servido (`index-YStszgQX.css`).

Aplicado tanto em `src/routes/lp.css` quanto na versão estática `landing/index.html`.

---

## Documentação relacionada

| Arquivo               | Conteúdo                                        |
| --------------------- | ----------------------------------------------- |
| `HANDOFF.md`          | 👈 **comece por aqui** — transferência de PC    |
| `docs/DEPLOY.md`      | Vercel, env vars, bloqueadores de deploy         |
| `docs/SUPABASE.md`    | Schema, RLS, funções, segurança do banco         |
| `docs/OPERACAO.md`    | Fluxo do dia a dia e diagnóstico de atendimento  |
| `MIGRACAO-SUPABASE.md`| Guia original da migração de banco               |

- **0 usuários reais, 0 eventos de telemetria** — ou seja, nada real a perder.
