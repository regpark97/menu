# 🚀 DEPLOY — Vercel, variáveis de ambiente e infraestrutura

> Como o SipFlow vai do `git push` até o cartão NFC do cliente.

---

## 1. Visão geral

```
┌──────────────┐   push    ┌────────────┐   build    ┌─────────────────────────┐
│  GitHub      │ ────────► │  Vercel    │ ─────────► │  bupin-app         │
│  regpark97/  │           │  projeto   │            │  .vercel.app            │
│  menu        │           │  "menu"    │            └───────────┬─────────────┘
└──────────────┘           └────────────┘                        │
                                                                 │
                              ┌──────────────────────────────────┘
                              ▼
                    ┌──────────────────┐
                    │  Supabase        │
                    │  ulxndzniyey     │
                    │  racujqmlu       │
                    └──────────────────┘
```

| Componente     | Identificador                                        |
| -------------- | ---------------------------------------------------- |
| Repositório    | `https://github.com/regpark97/menu.git`              |
| Branch prod    | `main`                                               |
| Vercel projeto | `menu`                                               |
| Vercel projId  | `prj_N2PbiTjI5ZwsMu45ZjRZp7DjqhGP`                   |
| Vercel orgId   | `team_g6f4ZR3TiKUhzKG5MNXNoW3B`                     |
| URL produção   | `https://bupin-app.vercel.app`                  |
| Supabase proj  | `ulxndzniyeyracujqmlu`                               |

> ⚠️ **Cuidado com URL parecida:** `menu-tau-bice.vercel.app` pertence a um projeto
> **abandonado do Lovable**. Não confunda. A URL correta é a `bupin-app`.

---

## 2. Build

`vercel.json`:

```json
{
  "buildCommand": "npm run build"
}
```

`package.json`:

```json
"build": "vite build",
"build:vercel": "cross-env NITRO_PRESET=vercel vite build",
"deploy:vercel": "vercel --prod"
```

**Como funciona:** o TanStack Start usa o **Nitro** como motor de build. O preset
`vercel` faz o Nitro gerar a **Build Output API v3** (`.vercel/output/`), o formato que
a Vercel espera (função serverless para SSR + assets estáticos).

Sem o preset, o Nitro assume **Cloudflare** e gera a estrutura errada → a Vercel
publica um site quebrado.

> ℹ️ Historicamente havia um `framework: null` no `vercel.json`. Foi **removido** —
> não era a causa do problema de deploy, mas era desnecessário.

### Testar o build localmente antes de subir

```powershell
npm run build:vercel
```

Se terminar sem erro e criar `.vercel/output/`, o build de produção vai funcionar.


---

## 3. ⚠️ Os dois bloqueadores que já custaram horas

### 3.1 Deploy `Blocked` — autor do commit não reconhecido

**O que aconteceu:** 6 commits foram criados com o autor `SipFlow <sipflow@local.dev>`.
Esse e-mail **não está vinculado a nenhuma conta Git** (GitHub/Vercel). A Vercel recusa
construir commits de autores que ela não consegue atribuir — o deploy fica `Blocked` e
some depois de ~20 horas.

**O que NÃO era o problema** (testado e descartado):
- ❌ `vercel.json` com `framework: null`
- ❌ `.gitignore` desatualizado
- ❌ configuração de build/projeto na Vercel
- ❌ permissões do repositório

**A correção:**

```powershell
# 1. Diagnóstico — veja o autor dos 5 últimos commits
git log -5 --pretty=format:'%h | %an <%ae> | %s'

# 2. Backup (SEMPRE antes de reescrever histórico)
git branch backup-pre-rewrite

# 3. Reescrever o autor de todos os commits
git filter-branch --env-filter '
  export GIT_AUTHOR_NAME="regpark97"
  export GIT_AUTHOR_EMAIL="lilomitofwdase@gmail.com"
  export GIT_COMMITTER_NAME="regpark97"
  export GIT_COMMITTER_EMAIL="lilomitofwdase@gmail.com"
' -- --all

# 4. Enviar (force — reescreveu histórico)
git push --force-with-lease origin main
```

**Resultado:** deploy `READY` em **26 segundos**.

> 🛡️ **Prevenção permanente** — configure o autor **antes** de qualquer commit, em
> qualquer máquina nova:
>
> ```powershell
> git config user.name  "regpark97"
> git config user.email "lilomitofwdase@gmail.com"
> ```
>
> Confira com `git config --list | Select-String user`.

> ⚠️ **Sobre o force-push:** este repositório está conectado ao **Lovable**, que espelha
> o histórico. Reescrever histórico publicado pode fazer o usuário perder histórico no
> editor do Lovable. Só faça isso com o deploy realmente bloqueado, e sempre com backup.

### 3.2 Site não abria — `ssoProtection` (Vercel Authentication)

**O que aconteceu:** depois do deploy passar, **qualquer** visita ao site pedia login
na Vercel. Essa é a opção **Vercel Authentication** (Deployment Protection), ativada
por padrão em alguns fluxos.

**Por que era crítico:** os cartões NFC dos clientes apontam para o site. Com essa
proteção ligada, **todos os NFC parariam**, e o cliente veria uma tela de login da
Vercel em vez do cardápio.

**Diagnóstico e correção pela API:**

```powershell
$env:VERCEL_TOKEN = "..."   # token com acesso ao projeto

# Ver o estado atual
curl.exe -s -H "Authorization: Bearer $env:VERCEL_TOKEN" `
  "https://api.vercel.com/v9/projects/menu?teamId=team_g6f4ZR3TiKUhzKG5MNXNoW3B"

# Desligar a proteção
curl.exe -s -X PATCH `
  -H "Authorization: Bearer $env:VERCEL_TOKEN" `
  -H "Content-Type: application/json" `
  -d '{"ssoProtection":null}' `
  "https://api.vercel.com/v9/projects/menu?teamId=team_g6f4ZR3TiKUhzKG5MNXNoW3B"
```

**Verificação final** (todas devem retornar 200 sem pedir login):

```powershell
foreach ($p in '/','/auth','/super-admin','/t/tag-001') {
  $code = curl.exe -s -o NUL -w '%{http_code}' "https://bupin-app.vercel.app$p"
  "$p -> $code"
}
```

> 🔔 **Vigie isso.** Se um dia o site voltar a pedir login, é isso de novo.
> No painel: Vercel → projeto `menu` → Settings → Deployment Protection →

---

## 4. Variáveis de ambiente

### Na Vercel

`Vercel → projeto menu → Settings → Environment Variables`
(marque **Production**, **Preview** e **Development**):

| Variável                        | Obrigatória | Valor esperado                              |
| ------------------------------- | ----------- | ------------------------------------------- |
| `SUPABASE_URL`                  | ✅          | `https://ulxndzniyeyracujqmlu.supabase.co`  |
| `SUPABASE_PUBLISHABLE_KEY`      | ✅          | `sb_publishable_…` ou `eyJ…`                |
| `SUPABASE_PROJECT_ID`           | opcional    | `ulxndzniyeyracujqmlu`                      |
| `VITE_SUPABASE_URL`             | ✅          | igual a `SUPABASE_URL`                      |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | ✅          | igual a `SUPABASE_PUBLISHABLE_KEY`          |
| `VITE_SUPABASE_PROJECT_ID`      | opcional    | `ulxndzniyeyracujqmlu`                      |

**Por que as duas versões (com e sem `VITE_`)?**

- `VITE_*` → embutidas no bundle do **navegador** (o cliente Supabase do front).
- sem prefixo → lidas em **runtime no servidor** (SSR/loaders do TanStack Start).

Sem as sem-prefixo, o SSR quebra em produção mesmo que o site "pareça" funcionar.

> 🔒 **Nunca** cadastre a chave `service_role` na Vercel. Ela ignora RLS e vazaria para
> o navegador. Só a `publishable`/`anon` vai para o front.

### Local (`.env`)

Arquivo **não versionado**. Use `.env.example` como modelo:

```powershell
copy .env.example .env
```

> ⚠️ Ao trocar de PC, o `.env` **precisa ser copiado manualmente** (ou recriado a partir
> do Supabase). É a única coisa que não vem pelo `git clone`.

---

## 5. Deploy — passo a passo

### Automático (o normal hoje)

```powershell
git add -A
git commit -m "feat: descrição da mudança"
git push origin main
```

A Vercel detecta o push e builda sozinha (~26s). Nada mais a fazer.

### Manual (plano B)

```powershell
npm run deploy:vercel     # npx vercel --prod
```

Útil se a integração Git estiver fora do ar.

### Local

```powershell
npm run dev
```

---

## 6. Supabase — projeto e conexão

```powershell
# Conectar o CLI ao projeto certo
npx supabase link --project-ref ulxndzniyeyracujqmlu

# Aplicar mudanças de schema
npx supabase db push
```

`supabase/config.toml` deve conter:

```toml
project_id = "ulxndzniyeyracujqmlu"
```

> 🐞 **Bug corrigido:** o arquivo apontava para `nlbmrbcvpvkmikyvfuur` — **outro
> projeto**. Um `supabase db push` teria aplicado mudanças no banco errado.
> Corrigido no commit `2279729`.

### Auth → URL Configuration (⚠️ PENDENTE)

```
Supabase → Authentication → URL Configuration
```

| Campo             | Valor                                    |
| ----------------- | ---------------------------------------- |
| **Site URL**      | `https://bupin-app.vercel.app`      |
| **Redirect URLs** | `https://bupin-app.vercel.app/**`   |
|                   | `https://bupin-app.vercel.app/auth` |

**Sem isso:** o e-mail de confirmação de cadastro manda o usuário para `localhost` (ou
para uma URL antiga do Lovable), a conta nunca é confirmada e o login falha com
`Invalid login credentials`.

### Settings → Database (⚠️ PENDENTE)

```
Supabase → Settings → Database → Reset database password
```

A senha do Postgres foi exposta. **Resetar.**


---

## 7. Testar em produção

```powershell
# Páginas públicas (devem dar 200 sem pedir login)
foreach ($p in '/','/auth','/super-admin','/t/tag-001') {
  $code = curl.exe -s -o NUL -w '%{http_code}' "https://bupin-app.vercel.app$p"
  "$p -> $code"
}
```

| URL                                             | Esperado                            |
| ----------------------------------------------- | ----------------------------------- |
| `https://bupin-app.vercel.app/`            | Landing page                        |
| `https://bupin-app.vercel.app/auth`        | Tela de login/cadastro              |
| `https://bupin-app.vercel.app/super-admin` | Redireciona p/ login se não logado  |
| `https://bupin-app.vercel.app/t/tag-001`   | Cardápio do café demo               |
| `https://bupin-app.vercel.app/c/francisco-porto` | Cardápio por slug             |

### Testar no celular com NFC

```
https://bupin-app.vercel.app/t/<tag_code>
```

Esse é o valor a **gravar na tag NFC**. Vantagens sobre testar em rede local:

- Funciona em **qualquer rede** (inclusive 4G do cliente) — sem depender do seu Wi-Fi;
- **HTTPS de graça** — o Chrome no Android só permite Web NFC em `https://`;
- Sem firewall, sem IP local mudando, sem `192.168.x.x`.

---

## 8. 🆘 Problemas comuns no deploy

| Sintoma                                    | Causa provável                   | Solução                                          |
| ------------------------------------------ | -------------------------------- | ------------------------------------------------ |
| Deploy `Blocked`                           | Autor do commit sem conta Git    | Seção 3.1                                        |
| Site pede login da Vercel                  | `ssoProtection` ligado           | Seção 3.2                                        |
| Build gera `.output/` (Cloudflare)         | `NITRO_PRESET` não aplicado      | Confirme `npm run build:vercel` / `vercel.json`  |
| Tela `500` no SSR em produção              | Env vars faltando na Vercel      | Cadastrar as 6 (seção 4)                         |
| Login redireciona para URL errada          | Site URL não configurada         | Seção 6 (Auth → URL Configuration)               |
| E-mail de confirmação leva a `localhost`   | Site URL não configurada         | Seção 6                                          |
| Rota `/t/xxx` mostra "ainda não está ativo"| Tag inexistente/inativa/órfã     | Ver `docs/OPERACAO.md`                           |
| "Vincular dono" dá erro de função          | `rpc-user-lookup.sql` não rodado | Rodar `supabase/rpc-user-lookup.sql`             |
| Cliente logado não vê painel               | Conta sem vínculo no tenant      | "Vincular dono" no Super Admin                   |
| Botão Google não funciona                  | Usa `@lovable.dev/cloud-auth-js` | Configurar OAuth nativo do Supabase              |

---

## 9. Checklist de deploy

Antes de dar push em algo importante:

- [ ] `npx tsc --noEmit` → 0 erros
- [ ] `npm run lint` → limpo
- [ ] `npm run test` → passando
- [ ] `npm run build:vercel` → gera `.vercel/output`
- [ ] `git config user.email` → `lilomitofwdase@gmail.com`
- [ ] Depois do push: a Vercel marcou **READY**?
- [ ] O site abre **sem** pedir login da Vercel?

> **Vercel Authentication: Disabled** · também **Password Protection: Disabled**.
