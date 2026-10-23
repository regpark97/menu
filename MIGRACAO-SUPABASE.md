# 🚀 Migrar para o seu próprio Supabase — Guia passo a passo

Este guia tira o SipFlow do banco gerenciado pelo Lovable e coloca em um projeto
Supabase **seu**, com backup sob o seu controle.

> ⏱️ Tempo estimado: ~20 minutos (10 clicando no Supabase, 10 automáticos).

---

## ✅ Situação atual (por que isso é seguro agora)

| Item                           | Quantidade                                |
| ------------------------------ | ----------------------------------------- |
| Estabelecimentos               | 1 (demonstração: _Francisco Coffee Shop_) |
| Categorias / Pratos / Tags NFC | 3 / 4 / 4 (todos de demonstração)         |
| **Usuários cadastrados**       | **0**                                     |
| **Eventos de métricas**        | **0**                                     |

**Não há nada real a perder.** Todo o conteúdo é dado de demonstração que a
própria migração recria. Este é o melhor momento possível para migrar.

🐞 **Bônus:** a migração também corrige um bug — o bucket de fotos `media`
nunca existiu no banco antigo, então o upload de imagens falhava.

---

## Passo 1 — Criar a conta no Supabase

1. Abra https://supabase.com e clique em **Start your project**.
2. Crie a conta com e-mail/senha (ou GitHub).
3. Você cai no painel de organizações.

## Passo 2 — Criar o projeto

1. Clique em **New project**.
2. Preencha:
   - **Name:** `sipflow` (ou o que preferir)
   - **Database Password:** clique em **Generate a password** e **COPIE ESSA SENHA**
     (você vai precisar dela no Passo 4 — guarde num gerenciador de senhas)
   - **Region:** escolha a mais próxima dos seus clientes
     (ex.: `South America (São Paulo)` se o café for no Brasil)
   - **Plan:** Free
3. Clique em **Create new project** e aguarde ~2 minutos (a "provisioning" roda).

## Passo 3 — Copiar as 3 chaves

No painel do projeto:

### a) URL e chave pública

**Project Settings → API** (ou _Settings → API Keys_):

| O que copiar               | Onde                             | Vai virar a variável                                         |
| -------------------------- | -------------------------------- | ------------------------------------------------------------ |
| **Project URL**            | `https://xxxxx.supabase.co`      | `SUPABASE_URL` / `VITE_SUPABASE_URL`                         |
| **anon / publishable key** | `sb_publishable_...` ou `eyJ...` | `SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_PUBLISHABLE_KEY` |
| **Project ID (Ref)**       | o `xxxxx` da URL                 | `SUPABASE_PROJECT_ID` / `VITE_SUPABASE_PROJECT_ID`           |

> 💡 A chave `publishable`/`anon` é **segura de expor** — ela vai para o navegador
> do usuário. Quem protege os dados são as regras de segurança (RLS), que a
> migração já configura.

### b) Chave secreta (só para a migração — NÃO entra no site)

**Project Settings → API → `service_role` / secret key**: copie para usar apenas
no Passo 4 (rodar SQL). Ela **nunca** deve ir para o `.env` do site nem para o Git.

### c) String de conexão do banco (para rodar as migrações)

**Project Settings → Database → Connection string → URI**.

- Use a aba **Session** (porta `5432`) ou **Direct connection**.
- Troque `[YOUR-PASSWORD]` pela senha do Passo 2.

Fica assim:

```
postgresql://postgres.xxxxxxxxxxxx:SENHA_AQUI@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
```

## Passo 4 — Rodar a migração (1 comando)

Com a string do Passo 3c em mãos, no terminal do projeto:

```powershell
$env:DATABASE_URL="postgresql://postgres.xxxx:SENHA@aws-0-sa-east-1.pooler.supabase.com:5432/postgres"
node migrate-to-own-supabase.mjs
```

O script:

1. executa `0000_migration.sql`, `0001_migration.sql` e `0002_media_bucket.sql`
   em ordem, cada um numa transação (se falhar, **faz rollback** — nada fica pela metade);
2. registra o que rodou em `drizzle.__drizzle_migrations` (pode rodar 2× sem problema);
3. **verifica** no final: 6 tabelas, 5 funções, o gatilho de novo usuário, o café
   de demonstração, os pratos e o bucket `media`.

Saída esperada no fim:

```
=== VERIFICACAO FINAL ===
  OK   tabelas        6 (esperado >= 6)
  OK   funcoes        5 (esperado >= 5)
  OK   trigger auth   1 (esperado >= 1)
  OK   tenant demo    1 (esperado >= 1)
  OK   produtos       4 (esperado >= 1)
  OK   bucket media   1 (esperado >= 1)

Migracao concluida com sucesso!
```

> Alternativa com o próprio Drizzle (se preferir):
> `npx drizzle-kit migrate` — lê a mesma `DATABASE_URL` (já ajustei o `drizzle.config.ts`).

## Passo 5 — Trocar as variáveis do `.env`

Substitua os valores (do Passo 3a) mantendo **os dois pares** de variáveis:

```env
SUPABASE_URL="https://xxxxx.supabase.co"
SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
SUPABASE_PROJECT_ID="xxxxx"

VITE_SUPABASE_URL="https://xxxxx.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
VITE_SUPABASE_PROJECT_ID="xxxxx"
```

Reinicie o servidor (`Ctrl+C` e `npm run dev`) — o Vite injeta as `VITE_*` no build.

## Passo 6 — Criar seu usuário (vira Super Admin)

1. Abra `http://localhost:8080/auth` e clique em **Cadastre-se**.
2. Use e-mail + senha (mínimo 6 caracteres).
3. Confirme o e-mail (verifique a caixa de entrada).
4. Faça login → o gatilho `handle_new_user` promove automaticamente o
   **primeiro usuário cadastrado a Super Admin**.

> ⚠️ Enquanto você não confirmar o e-mail, o usuário não existe em `auth.users`
> e o gatilho não dispara.
>
> ℹ️ O gatilho também tenta vincular esse primeiro usuário ao café de
> demonstração (`slug='francisco-coffee'`), mas essa linha não faz mais nada:
> os dados de demonstração foram removidos do banco. O que importa — o papel
> de **Super Admin** — continua sendo concedido normalmente.

## Passo 7 — Validar

- [ ] A página inicial (`/`) abre sem erro (banco vazio = lista vazia, normal)
- [ ] `/admin` abre com você logado
- [ ] Você cria o cliente em `/super-admin` (abas **Clientes** e **Tags NFC**)
- [ ] "Adicionar prato" grava e recarrega mantendo o dado
- [ ] Upload de foto de um prato funciona (o bug foi corrigido)
- [ ] Uma tag NFC abre o cardápio certo

---

## ⚠️ O que muda (e o que perdemos)

### Login com Google

O botão **"Continuar com Google"** usa o serviço de autenticação do Lovable
(`@lovable.dev/cloud-auth-js`), que **só funciona em domínios do Lovable**. Depois
da migração (e do deploy na Vercel) ele **não funciona**. Como o banco não tinha
nenhum usuário, ninguém depende dele.

**Estado atual:** o botão **não é exibido** fora de domínios do Lovable
(`*.lovable.app` / `*.lovable.dev`). Em `localhost`, na Vercel ou em domínio
próprio aparece apenas o formulário de e-mail + senha — sem botão quebrado e sem
risco de alguém clicar em algo que não funciona.

**Se quiser reativar com Google de verdade** (OAuth nativo do Supabase):

1. **Google Cloud Console** → _APIs e serviços_ → _Credenciais_ →
   _Criar credenciais_ → **ID do cliente OAuth** (tipo _Aplicativo da Web_).
2. Em **URIs de redirecionamento autorizados**, cole o callback do Supabase:
   ```
   https://SEU-PROJECT-ID.supabase.co/auth/v1/callback
   ```
3. Copie **Client ID** e **Client Secret**.
4. **Supabase** → _Authentication_ → _Providers_ → **Google** → ative e cole as
   duas chaves. Salve.
5. No código, substitua a chamada do Lovable pela do Supabase em
   `src/routes/auth.tsx`:
   ```ts
   await supabase.auth.signInWithOAuth({
     provider: "google",
     options: { redirectTo: window.location.origin + "/admin" },
   });
   ```
   Depois remova o `disabled` e o aviso do botão.
6. Confirme que o domínio está nos **Redirect URLs** do Supabase (Passo 9).

Em vez de reativar o OAuth nativo, uma alternativa mais simples é **remover o
botão de vez**: apague a função `googleAvailable()`, o estado `showGoogle` e o
bloco `google()` do `src/routes/auth.tsx`.

> O arquivo `src/integrations/lovable/index.ts` pode então ser removido junto com
> a dependência `@lovable.dev/cloud-auth-js` — mas nada quebra se ficar.

### O que continua funcionando sem mudanças

- E-mail + senha, RLS, métricas, NFC, cardápio público, imagens locais (`/images/*`).
- O `previewAuthStorage` detecta que **não** está em domínio Lovable (`localhost`
  ou seu domínio) e usa `localStorage` normal — nada a fazer.

---

## 🌐 Deploy na Vercel (link público + HTTPS)

O projeto já gera o **Build Output API v3** da Vercel — a própria Vercel documenta
que projetos Lovable/TanStack Start fazem deploy **zero-config** (exige
`@lovable.dev/vite-tanstack-config >= 2.6.2`; aqui está `2.26.5` ✅).

O `vite.config.ts` **não precisa de alteração**: o mesmo build serve Cloudflare
(padrão, `.output/`) ou Vercel (`.vercel/output/`), mudando só o `NITRO_PRESET`.
Isso já está fixado no `vercel.json`, então **nada de configurar no dashboard**.

### Variáveis de ambiente (Vercel → Settings → Environment Variables)

Cadastre as 6 abaixo em **Production + Preview + Development**:

| Variável                        | Valor                                |
| ------------------------------- | ------------------------------------ |
| `SUPABASE_URL`                  | `https://SEU-PROJECT-ID.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY`      | `sb_publishable_...`                 |
| `SUPABASE_PROJECT_ID`           | `SEU-PROJECT-ID`                     |
| `VITE_SUPABASE_URL`             | `https://SEU-PROJECT-ID.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...`                 |
| `VITE_SUPABASE_PROJECT_ID`      | `SEU-PROJECT-ID`                     |

> 🔴 **NUNCA** cadastre `SUPABASE_SERVICE_ROLE_KEY` (secret) na Vercel. Ela ignora
> o RLS e iria para o navegador. Ela só é necessária em scripts locais.
>
> `NITRO_PRESET=vercel` já vem do `vercel.json` — não precisa cadastrar.

### Passo 8 — Publicar (GitHub + Vercel)

```powershell
git init
git add .
git commit -m "SipFlow: Supabase proprio + deploy Vercel"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/sipflow.git
git push -u origin main
```

Depois: **vercel.com/new → Import Git Repository** → escolha o repositório →
cole as 6 variáveis → **Deploy**. Sai um link `https://sipflow-xxx.vercel.app`.

### Passo 9 — Liberar o domínio no Supabase (obrigatório)

Supabase → **Authentication → URL Configuration**:

- **Site URL:** `https://sipflow-xxx.vercel.app`
- **Redirect URLs:** `https://sipflow-xxx.vercel.app/**`

Sem isso o login/confirmação de e-mail vai para o domínio errado.

### Passo 10 — Testar no celular (NFC)

```
https://sipflow-xxx.vercel.app/t/tag-001
```

Esse é o valor a **gravar na tag NFC**. Vantagens sobre testes locais:

- Funciona em **qualquer rede** (4G do cliente), sem depender do seu Wi-Fi;
- **HTTPS** de graça — o Chrome no Android só permite Web NFC em `https://`
  (em `http://` local a leitura/escrita por software é bloqueada);
- Sem firewall, sem IP local mudando, sem `192.168.x.x`.

### Scripts de deploy

```powershell
npm run build:vercel   # gera .vercel/output (Build Output API v3)
npm run deploy:vercel  # npx vercel --prod (exige login) — alternativa ao Git
```

### 🆘 Problemas comuns no deploy

| Sintoma                            | Causa provável                   | Solução                                       |
| ---------------------------------- | -------------------------------- | --------------------------------------------- |
| Build gera `.output/` (Cloudflare) | `NITRO_PRESET` não aplicado      | Confirme o `vercel.json` no repositório       |
| Tela `500` no SSR em produção      | Env vars faltando na Vercel      | Cadastre as 6 (inclusive sem prefixo `VITE_`) |
| Login redireciona para URL errada  | Site URL não configurada         | Passo 9 acima                                 |
| Rota `/t/xxx` dá 404 em produção   | `routes` apagados                | Recrie as tags no `/super-admin`              |
| Botão Google não funciona          | Usa `@lovable.dev/cloud-auth-js` | Configure OAuth nativo do Supabase            |

---

## 🔒 Boas práticas depois

1. **Nunca** comite o `.env` (já está no `.gitignore`) nem a `service_role` key.
2. Ative **backups** (o plano Free não tem PITR; exporte antes de mudanças grandes).
3. Guarde a senha do banco num gerenciador de senhas.
4. Se um dia mudar de máquina, o `.env` é tudo que o site precisa.

---

## 🆘 Problemas comuns

| Sintoma                               | Causa provável                                | Solução                                                                   |
| ------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------- |
| `getaddrinfo ENOTFOUND`               | Host/ref errado na string                     | Copie a URI de novo em Settings → Database                                |
| `password authentication failed`      | Senha errada ou `[YOUR-PASSWORD]` não trocado | Reset a senha em Settings → Database                                      |
| `Cannot find module 'postgres'`       | Dependências não instaladas                   | Rode `npm install`                                                        |
| Migração "pulada" sem motivo          | Já rodou antes                                | É normal (idempotente); para forçar, limpe `drizzle.__drizzle_migrations` |
| Tabela `storage.buckets` não existe   | Banco não é Supabase (ex.: Postgres puro)     | Use um projeto Supabase                                                   |
| Login diz "Invalid login credentials" | E-mail não confirmado                         | Confirme pelo link do e-mail                                              |
