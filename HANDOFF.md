# 🤝 HANDOFF — Continuação do Projeto Bupin (antes SipFlow)

> **Documento principal de transferência.** Se você acabou de clonar este repositório
> em outro computador, **leia este arquivo de cima a baixo** antes de tocar em qualquer coisa.
>
> Última atualização: commit `1e32d3b` (10/11/2026) — branch `main`.

---

## 1. O que é o projeto

**SipFlow** é um micro-SaaS de cardápio digital ativado por **NFC/QR Code** na mesa.

- O cliente encosta o celular no cartão NFC da mesa → abre o cardápio do restaurante.
- O dono do restaurante gerencia pratos, categorias, fotos e Wi-Fi pelo painel.
- A equipe SipFlow gerencia os clientes pelo **Super Admin**.

**Stack:**

| Camada      | Tecnologia                                                  |
| ----------- | ----------------------------------------------------------- |
| Frontend    | React 19 + TanStack Router / Start (roteamento por arquivo) |
| Estilo      | Tailwind CSS 4 + shadcn/ui (Radix) + lucide-react           |
| Backend/DB  | Supabase (Postgres + Auth + Storage) — **projeto próprio**   |
| Build/Deploy| Vite → Nitro (preset `vercel`) → **Vercel**                 |
| Testes      | Vitest                                                      |

---

## 2. 🗝️ Credenciais e endpoints (o essencial para retomar)

| Item                      | Valor                                                  |
| ------------------------- | ------------------------------------------------------ |
| **Repositório GitHub**    | `https://github.com/regpark97/menu.git`                |
| **Branch de produção**    | `main`                                                 |
| **URL de produção**       | `https://bupin-app.vercel.app`                    |
| **Supabase Project ID**   | `ulxndzniyeyracujqmlu`                                 |
| **Supabase Dashboard**    | `https://supabase.com/dashboard/project/ulxndzniyeyracujqmlu` |
| **Vercel Project**        | `bupin` (antes `menu`; renomeado — URL `bupin-app`)    |
| **Autor dos commits**     | `regpark97 <lilomitofwdase@gmail.com>` ⚠️ **obrigatório** |

> ⚠️ **NUNCA** mude o autor dos commits. A Vercel **bloqueia o deploy** de commits
> cujo e-mail não esteja vinculado a uma conta Git. Isso já causou 20h de deploy travado.
> Veja a seção 7 para o comando de correção.

### Rotas do app

| Rota             | Arquivo                                      | Para que serve                      |
| ---------------- | -------------------------------------------- | ----------------------------------- |
| `/`              | `src/routes/index.tsx`                       | Landing page                        |
| `/auth`          | `src/routes/auth.tsx`                        | Login e criação de conta            |
| `/c/$slug`       | `src/routes/c.$slug.tsx`                     | **Cardápio público** do restaurante |
| `/t/$tag`        | `src/routes/t.$tag.tsx`                      | **Destino da tag NFC** → redireciona |
| `/admin`         | `src/routes/_authenticated/admin.tsx`        | Painel do dono do restaurante       |
| `/super-admin`   | `src/routes/_authenticated/super-admin.tsx`  | Painel da equipe SipFlow            |

> `/admin` e `/super-admin` ficam sob `_authenticated/route.tsx`, que exige sessão.


---

## 3. ✅ O que JÁ FOI FEITO (verificado em produção)

### 3.1 Migração para Supabase próprio

O projeto saiu do Supabase gerenciado pelo Lovable e passou a usar um projeto próprio
(`ulxndzniyeyracujqmlu`).

- `migrate-to-own-supabase.mjs` — script de migração (tabelas, funções, triggers, dados demo).
- `MIGRACAO-SUPABASE.md` — guia passo a passo completo.
- `.env` (local, **não versionado**) com as 3 chaves do projeto novo.
- `supabase/config.toml` — corrigido para apontar para `ulxndzniyeyracujqmlu`.

### 3.2 Segurança endurecida — `supabase/hardening.sql`

Corrige **dois furos críticos**:

1. **Auto-promoção a Super Admin.** `user_roles` tinha RLS ativo + GRANT para
   `authenticated`, mas **nenhuma policy** de INSERT/DELETE. No Postgres, "sem policy"
   = **liberado**. Ou seja: qualquer usuário logado podia se tornar Super Admin.
   → Agora só existe leitura (`read own roles`); escrita só via `service_role`.

2. **"Primeiro cadastrado manda".** O trigger `handle_new_user` promovia o **primeiro**
   usuário cadastrado a Super Admin. Se a conta sumisse, o próximo estranho virava dono.
   → Agora **todo** novo usuário entra como `'user'`, sempre. Super Admin é concedido à mão.

Também inclui, comentado e pronto para ativar, o bloco que restringe o cardápio público
a estabelecimentos com `active = true`.

**Status:** ✅ rodado no Supabase (verificado).

### 3.3 Vínculo de dono por e-mail — Modelo A — `supabase/rpc-user-lookup.sql`

Criou a função:

```sql
public.user_id_by_email(_email text) returns uuid
  language plpgsql stable security definer set search_path = public, auth
```

- `SECURITY DEFINER` → consegue ler `auth.users`, que o cliente nunca enxerga.
- Trava explícita: quem não for `super_admin` recebe exceção `Acesso restrito à equipe SipFlow`.
- Normaliza com `lower(email) = lower(trim(_email))` → tolera maiúsculas e espaços.
- `revoke` de `public`/`anon`; `grant execute` só para `authenticated`.

**Status:** ✅ rodado no Supabase — confirmado na tela (`Database → Functions`, tipo
`function`, retorno `uuid`, marcado como **Definer**).

### 3.4 Botões novos no Super Admin — `src/routes/_authenticated/super-admin.tsx`

| Recurso             | O que faz                                                                        | Linha aprox. |
| ------------------- | -------------------------------------------------------------------------------- | ------------ |
| **Criar cliente**   | Cria o estabelecimento e, se o e-mail já tiver conta, **vincula automaticamente** | 85–123       |
| **Vincular dono**   | Vincula por e-mail via RPC (sem colar UUID)                                      | 192–216      |
| **Trocar dono**     | Mesmo botão quando já existe dono                                                | 326          |
| **Desvincular**     | Zera `owner_user_id`                                                             | 219–224      |
| **Excluir cliente** | Apaga o tenant; antes solta as tags NFC (`on delete set null`)                   | 226–250      |

Avisos inteligentes implementados:

- E-mail com conta → `"Estabelecimento criado e vinculado a <email>"` (verde)
- E-mail **sem** conta → `"<email> ainda não tem conta: peça para se cadastrar em /auth..."`
  (amarelo, 8s)

### 3.5 Destravamento do deploy automático (a saga das 20 horas)

**Sintoma:** todos os deploys automáticos da Vercel ficavam `Blocked` por ~20 horas.

**Diagnóstico e correção, em ordem:**

1. ❌ Suspeita inicial: `vercel.json`. Testado remover `framework: null` e limpar
   `.gitignore` → **não era isso** (mas as limpezas ficaram, são boas).
2. ✅ **Causa real:** os 6 commits estavam com autor `SipFlow <sipflow@local.dev>`,
   um e-mail **não vinculado a nenhuma conta Git**. A Vercel recusa construir esses
   commits. O repositório e o `vercel.json` **não tinham problema nenhum**.
3. ✅ **Correção:** reescrita dos 6 commits com `git filter-branch` para o autor
   `regpark97 <lilomitofwdase@gmail.com>` + force-push.
   - `a03d75f → ea91d9d` (antes) → hoje `2279729`
   - ⚠️ Um branch de backup foi preservado: **`backup-pre-rewrite`**
4. ✅ **Resultado:** deploy automático passou a `READY` em **26s**.

### 3.6 Segundo bloqueador crítico — `ssoProtection` (Vercel Authentication)

Depois do deploy passar, o site **ainda** não era público: estava ligada a proteção
**Vercel Authentication** (`ssoProtection`), que exige login na Vercel para **qualquer**
visita. Isso **quebraria todos os cartões NFC** dos clientes.

- Descoberto via API: `GET /v9/projects/menu`
- **Corrigido** via `PATCH /v9/projects/menu` → `ssoProtection: null`
- ✅ Verificado: `/`, `/auth`, `/super-admin`, `/t/tag-001` → **HTTP 200 público**

### 3.7 Correções menores

- `supabase/config.toml` → `project_id` estava `nlbmrbcvpvkmikyvfuur` (**projeto errado!**);
  corrigido para `ulxndzniyeyracujqmlu`. Sem isso, um futuro `supabase link`/`db push`
  mexeria no banco errado.
- `.gitignore` revisado — garante que `.env`, `.env.*`, `.vercel`, `dist`, `*.log`
  **nunca** vão para o Git. Confirmado: apenas `.env.example` é versionado.
- `drizzle/migrations/0002_media_bucket.sql` — o bucket `media` nunca tinha sido criado
  (só as policies), por isso o upload de fotos falhava.

### 3.8 Validações executadas (todas passando)

| Verificação                | Comando             | Resultado           |
| -------------------------- | ------------------- | ------------------- |
| Tipos TypeScript           | `npx tsc --noEmit`  | ✅ 0 erros          |
| Testes                     | `npx vitest run`    | ✅ 1 passed         |
| Lint                       | `npx eslint .`      | ✅ sem erros/avisos |
| Site público               | `curl -L` nas rotas | ✅ HTTP 200         |
| Bundle com features novas  | grep no chunk       | ✅ `Excluir cliente`, `Vincular dono`, `Trocar dono`, `user_id_by_email` |

- Exclusão com dono vinculado → aviso de que a pessoa **perde o acesso na hora**


---

## 4. ⏳ O QUE FALTA FAZER

### 4.1 🔴 URGENTE — Resetar a senha do banco (vazada)

A senha do Postgres foi exposta em algum momento. **Se ainda não foi resetada, faça agora.**

```
Supabase → Settings → Database → Reset database password
```

Depois de resetar, se algum script local usar a string de conexão, atualize-a.

### 4.2 🟡 Configurar as URLs de Auth (senão o e-mail de confirmação quebra)

```
Supabase → Authentication → URL Configuration
```

| Campo             | Valor                                    |
| ----------------- | ---------------------------------------- |
| **Site URL**      | `https://bupin-app.vercel.app`      |
| **Redirect URLs** | `https://bupin-app.vercel.app/**`   |
|                   | `https://bupin-app.vercel.app/auth` |

Sem isso, o link de confirmação de e-mail do novo cliente aponta para o **lugar errado**
(ou para `localhost`), e a pessoa não consegue ativar a conta.

### 4.3 🟡 Conferir as variáveis de ambiente na Vercel

```
Vercel → projeto menu → Settings → Environment Variables
```

Precisam existir, em **Production + Preview + Development**:

| Variável                        | Obrigatória |
| ------------------------------- | ----------- |
| `SUPABASE_URL`                  | ✅          |
| `SUPABASE_PUBLISHABLE_KEY`      | ✅          |
| `SUPABASE_PROJECT_ID`           | opcional    |
| `VITE_SUPABASE_URL`             | ✅          |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | ✅          |
| `VITE_SUPABASE_PROJECT_ID`      | opcional    |

> `NITRO_PRESET=vercel` já está no `package.json` (`build:vercel`).
> Não precisa cadastrar.

### 4.4 🟡 Cadastrar o primeiro cliente real

Ordem recomendada (**Caminho B** — vínculo automático):

```
1. O cliente cria a conta em  /auth  com o e-mail dele e confirma pelo link
2. No Super Admin → Clientes → preencha Nome + slug + e-mail → "Criar"
3. ✅ Vincula sozinho ("Estabelecimento criado e vinculado a <email>")
```

O caminho inverso também funciona (criar cliente → a pessoa se cadastra → **Vincular dono**),
mas exige o passo manual extra.

⚠️ **Regras do slug:** só `a-z`, `0-9` e `-`. **Nunca use acento** — o sistema troca
caractere inválido por `-`, e "Zé" vira "z-". Prefira `pizzaria-do-ze`.

> ℹ️ **Importante:** não existe "aprovar usuário" no sistema. Quando alguém se cadastra
> em `/auth`, **nada aparece no Super Admin** (ele lista estabelecimentos, não contas).
> O vínculo acontece na criação do cliente ou pelo botão "Vincular dono".

### 4.5 🟢 Melhoria opcional — aba "Usuários" no Super Admin

Hoje o Super Admin lista **estabelecimentos** (`tenants`), não **pessoas**
(`auth.users`). Quando alguém se cadastra em `/auth` e ainda não tem cliente,
**nada aparece na tela** — isso confunde (parece que sumiu).

Se isso incomodar, vale implementar uma aba **"Usuários"** com:

- Lista de contas (e-mail, data, se confirmou)
- Filtro **"sem estabelecimento"** ← mostra quem se cadastrou e está pendente
- Botão **"Criar cliente para esta pessoa"** (pré-preenche o e-mail)

Exigiria uma RPC nova no estilo `user_id_by_email`, restrita a `super_admin`.
**Ainda não implementado.**

### 4.6 🟢 Limpeza pendente

- Existem `tmp-deploy.log`, `tmp-deploy2.log` na raiz, **travados por um processo
  antigo do Vercel CLI**. São ignorados pelo `.gitignore` (`*.log`) — **não vão para o
  Git**, não atrapalham. Podem ser apagados após reiniciar o PC.
- Conta de teste `costaanaercilia@gmail.com` (sem o `984`) — **apagar** em

---

## 5. 🚀 Como rodar em outro PC (do zero)

```powershell
# 1. Clonar
git clone https://github.com/regpark97/menu.git
cd menu

# 2. Confirmar o autor do git (IMPORTANTE — ver seção 7)
git config user.name  "regpark97"
git config user.email "lilomitofwdase@gmail.com"

# 3. Instalar dependências
npm install

# 4. Criar o .env (NÃO está no Git!) — copie do outro PC ou do Supabase
copy .env.example .env
#    e preencha as 6 variáveis com os valores do projeto ulxndzniyeyracujqmlu

# 5. Rodar local
npm run dev

# 6. Validar antes de mexer
npm run lint
npm run test
npx tsc --noEmit
```

> ⚠️ **O `.env` é a única coisa que você precisa copiar manualmente do PC antigo.**
> Sem ele, o app não conecta no Supabase.

### Scripts disponíveis

| Script                  | O que faz                       |
| ----------------------- | ------------------------------- |
| `npm run dev`           | Servidor de desenvolvimento     |
| `npm run build`         | Build de produção               |
| `npm run build:vercel`  | Build com `NITRO_PRESET=vercel` |
| `npm run deploy:vercel` | Deploy manual (`vercel --prod`) |
| `npm run lint`          | ESLint                          |
| `npm run format`        | Prettier                        |
| `npm run test`          | Vitest (uma execução)           |
| `npm run test:watch`    | Vitest em modo watch            |

---

## 6. 🔄 Como o deploy funciona hoje

```
git push origin main
      ↓
Vercel detecta o push (integração Git)
      ↓
Build automático (npm run build) — ~26s
      ↓
https://bupin-app.vercel.app  ✅
```

**Não é preciso rodar `vercel --prod`.** O deploy automático está funcionando.
A alternativa manual (`npm run deploy:vercel`) só serve como plano B.

---

## 7. 🆘 TROUBLESHOOTING (problemas já enfrentados)

### Deploy fica `Blocked` na Vercel

**Causa:** o autor do commit não está vinculado a uma conta Git (e-mail errado).

**Verificar:**

```powershell
git log -5 --pretty=format:'%h | %an <%ae> | %s'
```

**Corrigir** (se aparecer algo diferente de `regpark97 <lilomitofwdase@gmail.com>`):

```powershell
git filter-branch --env-filter '
  export GIT_AUTHOR_NAME="regpark97"
  export GIT_AUTHOR_EMAIL="lilomitofwdase@gmail.com"
  export GIT_COMMITTER_NAME="regpark97"
  export GIT_COMMITTER_EMAIL="lilomitofwdase@gmail.com"
' -- --all
git push --force-with-lease origin main
```

> ⚠️ **Este projeto está conectado ao Lovable.** Reescrever histórico já publicado é
> arriscado (o usuário pode perder histórico no editor). Só faça isso se o deploy
> estiver realmente bloqueado — e sempre crie um branch de backup antes
> (foi o que gerou o `backup-pre-rewrite`).

### Site pede login da Vercel / aparece tela de autenticação

**Causa:** `ssoProtection` ligado de novo (ex.: alguém configurou no painel).
**Verificar/corrigir** pela API:

```powershell
# Ver
curl.exe -s -H "Authorization: Bearer $env:VERCEL_TOKEN" `
  "https://api.vercel.com/v9/projects/menu?teamId=team_g6f4ZR3TiKUhzKG5MNXNoW3B"

# Desligar
curl.exe -s -X PATCH -H "Authorization: Bearer $env:VERCEL_TOKEN" `
  -H "Content-Type: application/json" `
  -d '{"ssoProtection":null}' `
  "https://api.vercel.com/v9/projects/menu?teamId=team_g6f4ZR3TiKUhzKG5MNXNoW3B"
```

É o mais crítico de vigiar: se voltar a ligar, **todos os NFC param**.

### "Vincular dono" dá erro

| Mensagem                                               | Causa                           | Solução                                |
| ------------------------------------------------------ | ------------------------------- | -------------------------------------- |
| `function public.user_id_by_email(text) does not exist` | `rpc-user-lookup.sql` não rodado | Rodar `supabase/rpc-user-lookup.sql`   |
| `Acesso restrito à equipe SipFlow`                     | Sua conta não é `super_admin`   | Conceder super admin (seção 8)         |
| Aviso "…ainda não tem conta"                           | E-mail não tem cadastro         | A pessoa se cadastrar em `/auth`       |

### Cliente loga mas vê painel vazio

**Causa:** a conta existe mas o estabelecimento não tem `owner_user_id`.
**Solução:** Super Admin → cliente → **"Vincular dono"** → digitar o e-mail.

### Erro `Invalid login credentials`

A conta pode estar **sem confirmar o e-mail**. Confirmar pelo link, ou verificar
`Authentication → Providers → Email` no Supabase.

### Rota `/t/<tag>` diz "Este cartão ainda não está ativo"

| Causa possível                       | Verificar                                        |
| ------------------------------------ | ------------------------------------------------ |
| Tag não existe                       | Super Admin → Tags NFC → a tag está na lista?     |
| Tag com `active = false`             | Mesma tela, campo ativo                           |
| Tag sem `tenant_id`                  | Vincular a tag a um estabelecimento               |
| Estabelecimento com `active = false` | A policy exige `active` para leitura pública      |

> ℹ️ Este fluxo **já foi testado em produção** (`/t/tag-001` → HTTP 200). O join
> `tenants(slug)` funciona porque a policy `public read active tenants` libera leitura
> quando `active = true`.

---

## 8. 🔑 Conceder Super Admin a alguém

Edite o e-mail no bloco final de `supabase/hardening.sql` e rode:

```sql
insert into public.user_roles (user_id, role)
select id, 'super_admin' from auth.users where email = 'seu-email@exemplo.com'
on conflict do nothing;
```

**Revogar:**

```sql
delete from public.user_roles
where role = 'super_admin'
  and user_id = (select id from auth.users where email = 'email-a-revogar@exemplo.com');
```

**Conferir quem é Super Admin hoje:**

```sql
select u.email, r.role, r.user_id
from public.user_roles r
join auth.users u on u.id = r.user_id
where r.role = 'super_admin';
```


---

## 9. 📁 Mapa dos arquivos importantes

| Arquivo                                     | Papel                                                      |
| ------------------------------------------- | ---------------------------------------------------------- |
| `supabase/hardening.sql`                    | 🔒 Correção de segurança (RLS + trigger) — **já rodado**   |
| `supabase/rpc-user-lookup.sql`              | 🔑 RPC `user_id_by_email` — **já rodado**                  |
| `drizzle/migrations/0000_migration.sql`     | Schema base: tabelas, RLS, funções, dados demo             |
| `drizzle/migrations/0002_media_bucket.sql`  | Bucket `media` do Storage + policies                       |
| `migrate-to-own-supabase.mjs`               | Script de migração para o Supabase próprio                 |
| `MIGRACAO-SUPABASE.md`                      | Guia completo da migração                                  |
| `vercel.json`                               | `buildCommand: npm run build`                              |
| `.env.example`                              | Modelo das 6 variáveis (o real, `.env`, não é versionado)  |
| `supabase/config.toml`                      | `project_id` do Supabase CLI                               |
| `src/routes/_authenticated/super-admin.tsx` | Painel da equipe SipFlow (606 linhas)                      |
| `src/routes/_authenticated/admin.tsx`       | Painel do dono (753 linhas)                                |
| `src/routes/c.$slug.tsx`                    | Cardápio público (337 linhas)                              |
| `src/routes/t.$tag.tsx`                     | Resolvedor da tag NFC (53 linhas)                          |
| `AGENTS.md`                                 | Aviso sobre o Lovable (não reescrever histórico)           |
| `docs/DEPLOY.md`                            | Detalhes de deploy e infra                                 |
| `docs/SUPABASE.md`                          | Schema, RLS, RPCs e segurança do banco                     |
| `docs/OPERACAO.md`                          | Fluxo do dia a dia (criar cliente, vincular, tags)         |
| `docs/HISTORICO.md`                         | Linha do tempo do que foi feito e por quê                  |

---

## 10. ⚠️ Regras de ouro deste projeto

1. **Nunca** comite `.env` nem a chave `service_role`/`secret`. Só a `publishable` vai
   ao navegador.
2. **Nunca** force-push em `main` — o projeto está ligado ao **Lovable**, que espelha
   o histórico. Se precisar, crie branch de backup antes.
3. **Sempre** mantenha o autor dos commits como `regpark97 <lilomitofwdase@gmail.com>`,
   senão a Vercel bloqueia o deploy.
4. **Vigie** o `ssoProtection` da Vercel — se ligar, todos os NFC param.
5. **Nunca** use acento em `slug`.
6. Antes de mexer em SQL, lembre: **"sem policy" = liberado** no Postgres. RLS ativo
   sem nenhuma policy é o pior cenário possível.

---

## 11. 📋 Checklist rápido de retomada

Copie isto e vá marcando:

- [ ] `git clone` + `git config` do autor correto
- [ ] `npm install`
- [ ] Copiar `.env` do PC antigo (ou recriar a partir do Supabase)
- [ ] `npm run dev` funcionando local
- [ ] Resetar a senha do Postgres (seção 4.1)
- [ ] Configurar Auth → URL Configuration (seção 4.2)
- [ ] Conferir as 6 env vars na Vercel (seção 4.3)
- [ ] Confirmar que o site está público (sem tela de login da Vercel)
- [ ] Testar `/t/tag-001` no celular pelo 4G
- [ ] Cadastrar o primeiro cliente real (seção 4.4)
- [ ] Decidir sobre a aba "Usuários" (seção 4.5)

---

--

## 12. 🆕 Histórico de features (SipFlow → Bupin)

Registro das funcionalidades adicionadas depois da migração. Código já está em `main`.
URL de produção única: **https://bupin-app.vercel.app** (projeto Vercel = `bupin`).

### 12.1 Renomear SipFlow → Bupin
- Substituído em todo o `src/` (AppHeader, títulos, rotas). `package.json` name = `bupin`.
- Domínios antigos (`menu-regpark97`, `menu-tau-bice`) removidos; ficou só `bupin-app.vercel.app`.

### 12.2 Moderação de fotos (já existia, endurecida)
- Dono envia foto → vai para `pending_media_url` → Super Admin aprova em **Moderação**.
- Trigger `guard_moderation()` no banco impede auto-publicação pelo dono.
- Badge numérico vermelho no header (ao lado de Super Admin) com contagem pendente (`usePendingModerationCount`, polling 60s).

### 12.3 Galeria de múltiplas fotos por produto — `0003_product_gallery.sql`
- Novas colunas: `media_gallery` (jsonb) e `pending_media_gallery` (jsonb).
- Dono: botões "Nova capa" e "Adicionar fotos" (múltiplas). Miniaturas pendentes removíveis.
- Moderação: aprova capa + galeria juntas.
- Cardápio público: **swipe horizontal** entre as fotos do prato, com bolinhas indicadoras.
- Helpers em `src/lib/format.ts`: `parseGallery()` e `productPhotos()`.

### 12.4 Wi-Fi + Google editáveis pelo dono
- Card `WifiCard` no `/admin` virou "Wi-Fi e Google" com: SSID, senha e link do Google Maps.
- Os botões "Conectar ao Wi-Fi" e "Avaliar no Google" do cardápio só aparecem quando estes campos estão preenchidos.

### 12.5 Aparência da loja (logo + fundo) — pelo celular
- Card `BrandingCard` no `/admin`: upload de **logo** e **imagem/vídeo de fundo** direto da galeria do celular.
- Salva em `logo_url` / `bg_image_url` e reflete no cardápio na hora. Sem moderação (identidade da loja).

### 12.6 "Chamar garçom" (bolinha flutuante) — `0004_waiter_calls.sql`
- **Cliente**: bolinha no **canto superior direito** do cardápio, pulso suave. Menu com 3 opções:
  Chamar garçom / Pedir a conta / Falar com o gerente. Envia a mesa (`table_ref`).
- **Anti-spam**: RPC `call_waiter(_tenant, _table, _kind)` valida cooldown de 2 min por mesa (SECURITY DEFINER).
- **Painel do dono**: card `WaiterCalls` na aba Cardápio Rápido — lista em **tempo real** (Supabase Realtime)
  + polling de 15s de fallback, contador, tempo ("há X min") e botão "Atendido". Som opcional (bipe).
- Tabela `waiter_calls` (tenant_id, table_ref, kind, status, created_at, done_at), RLS por tenant, realtime ligado.

### 12.7 Restaurante demo recriado
- "Francisco Coffee Shop" (slug `francisco-coffee`, id fixo `11111111-...`) foi recriado no banco com 3 categorias,
  4 produtos, Wi-Fi (`Francisco_Guest`) e link do Google. Tags tag-001..004 vinculadas. Serve de vitrine/teste.
- Script: `supabase/restore-demo-francisco.sql` (idempotente).

### 12.8 Validações
- `npx tsc --noEmit` = 0 erros; `npx vitest run` = 1 passed; `npx eslint` = 0 erros.

### 12.9 Landing page BUPIN na rota `/` + captura de leads — 10/11/2026 (`5164011`)
- **Landing page** do produto na rota `/` (`src/routes/index.tsx` + `src/routes/lp.css`), na identidade
  da marca (dark chocolate + bege areia). Mockup de celular com vídeos reais do cardápio.
- **Formulário de leads** no fim da LP → tabela `leads` — **migration `0006_leads.sql`**
  (⚠️ rodar no Supabase antes do primeiro deploy).
- **Aba "Leads da LP"** no Super Admin (`src/components/dashboard/LeadsSection.tsx`):
  lista e-mail, WhatsApp e avanço de status (Novo → Contatado → Demo → Fechado).
- Versão estática standalone em `landing/index.html` (abre sem build) + vídeos em `public/landing/videos/`.
- Guia: `landing/INTEGRACAO-SUPER-ADMIN.md`.

### 12.10 Hardening do fluxo de auditoria — 10/11/2026 (`8cebb18`)
- **Migration `0007_fix_new_user_trigger.sql`** — ajusta o trigger de novo usuário
  (⚠️ **nunca pular**; aplicar após a `0006`).
- Limpeza de peso morto: imagens/vídeos duplicados da LP removidos de `landing/`
  (ficaram só os de `public/landing/`), pacote enxugado no `package-lock.json`.
- Reforços em `src/lib/media.ts`, `src/lib/telemetry.ts` e `admin.tsx`.

### 12.11 Docs e comentários — 10/11/2026 (`b655dea`)
- Comentários do código refatorados; **README raiz reescrito** (agora aponta a landing page
  e a ordem das migrations: `0000 → 0002 → 0004 → 0005 → 0006 → 0007`).

### 12.12 Tema claro/escuro do painel admin — 10/11/2026 (`1e32d3b`)
- Painel `/admin` ganhou **tema claro/escuro** (`src/routes/index.tsx` + `lp.css`).
- Copy da landing page neutralizada (sem "Bupin" hardcode em lugares errados).

---

## 13. ⏳ Atualização das pendências (10/11/2026)

Revisão do estado das pendências da seção 4 após os commits de hoje:

| Pendência (seção 4) | Estado | Observação |
| --- | --- | --- |
| 4.1 Resetar senha do Postgres | ⚠️ verificar | Confirmar no dashboard se já foi feita |
| 4.2 Auth → URL Configuration | ⚠️ verificar | Site URL/Redirects para `bupin-app.vercel.app` |
| 4.3 Env vars na Vercel | ⚠️ verificar | As 6 variáveis, nos 3 ambientes |
| 4.4 Primeiro cliente real | ⏳ aberta | Usar o Caminho B (vínculo automático) |
| 4.5 Aba "Usuários" no Super Admin | ⏳ não implementada | Opcional |
| 4.6 Limpeza (`tmp-deploy*.log`, conta de teste) | ⏳ aberta | Verificar se ainda existem |
| **Migrations 0005–0007** | ✅ rodadas | Confirmado pelo dono do projeto em 10/11/2026 |
| **Auditoria de segurança/código** | 🆕 ver docs/AUDITORIA-2026-11-10.md | 1 achado CRÍTICO (storage sem isolamento por tenant) + 2 altos; correções sugeridas no relatório |

---

**Fim do handoff.** Bom trabalho no PC novo! 🚀
