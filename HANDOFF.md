# 🤝 HANDOFF — Continuação do Projeto SipFlow (troca de PC)

> **Documento principal de transferência.** Se você acabou de clonar este repositório
> em outro computador, **leia este arquivo de cima a baixo** antes de tocar em qualquer coisa.
>
> Última atualização: commit `2279729` — branch `main`.

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
| **URL de produção**       | `https://menu-regpark97.vercel.app`                    |
| **Supabase Project ID**   | `ulxndzniyeyracujqmlu`                                 |
| **Supabase Dashboard**    | `https://supabase.com/dashboard/project/ulxndzniyeyracujqmlu` |
| **Vercel Project**        | `menu` (projectId `prj_N2PbiTjI5ZwsMu45ZjRZp7DjqhGP`)  |
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
| **Site URL**      | `https://menu-regpark97.vercel.app`      |
| **Redirect URLs** | `https://menu-regpark97.vercel.app/**`   |
|                   | `https://menu-regpark97.vercel.app/auth` |

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
https://menu-regpark97.vercel.app  ✅
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

**Fim do handoff.** Bom trabalho no PC novo! 🚀

  `Authentication → Users` se ainda existir. Ela não tem estabelecimento, é lixo.
