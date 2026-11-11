# BUPIN

> ## 📚 Antes de mexer: leia a documentação
>
> | Documento | Para que serve |
> | --- | --- |
> | **[`HANDOFF.md`](./HANDOFF.md)** | 👈 **comece por aqui** — credenciais, o que já foi feito, o que falta fazer (transferência de PC) |
> | [`landing/README.md`](./landing/README.md) | A landing page da rota `/` — estrutura, formulário de leads e versão estática |
> | [`docs/OPERACAO.md`](./docs/OPERACAO.md) | O dia a dia: criar cliente, vincular dono, tags NFC, diagnóstico |
> | [`docs/DEPLOY.md`](./docs/DEPLOY.md) | Vercel, variáveis de ambiente, deploy travado |
> | [`docs/SUPABASE.md`](./docs/SUPABASE.md) | Schema, RLS, funções e segurança do banco |
> | [`docs/HISTORICO.md`](./docs/HISTORICO.md) | Linha do tempo: o que foi feito, quando e por quê |
> | [`MIGRACAO-SUPABASE.md`](./MIGRACAO-SUPABASE.md) | Guia original da migração de banco |
>
> ⚠️ **Regras críticas:** commits devem ser do autor
> `regpark97 <lilomitofwdase@gmail.com>` (senão a Vercel bloqueia o deploy);
> nunca comite o `.env`; nunca force-push em `main` (projeto ligado ao Lovable).

## 🚀 Landing page (página inicial)

A rota `/` é a landing page do BUPIN (dark chocolate + bege areia da marca). Detalhes
completos em [`landing/README.md`](./landing/README.md).

- **Formulário de leads** (seção final da LP) envia direto para a tabela `leads`
  (migration `drizzle/migrations/0006_leads.sql`) — **é preciso rodar essa migration no
  Supabase antes do primeiro deploy**.
- **Aba "Leads da LP"** no Super Admin lista todos os envios, com e-mail, WhatsApp e
  avanço de status (Novo → Contatado → Demo → Fechado).
- Mockup do celular com vídeos reais do cardápio (arquivos em `public/landing/videos/`).
- Versão estática standalone em `landing/index.html` (abre no navegador sem build).

---

## O que é o BUPIN

Micro-SaaS de **cardápio interativo vertical** para cafés e restaurantes:

1. O cliente **toca na tag NFC da mesa** (ou escaneia o QR) → `/t/:tag` redireciona
   para o cardápio do estabelecimento já com a mesa identificada — sem app.
2. **Customer Hub** → boas-vindas com a marca da casa, Wi-Fi em 1 toque
   (copiar senha) e link direto para avaliar no Google.
3. **Feed vertical estilo Reels** → cada prato em tela cheia (foto ou vídeo em
   loop), swipe horizontal para a galeria, favoritos, personalização com
   adicionais e total ao vivo.
4. **Telemetria invisível** → cada gesto (view com tempo de atenção, swipe,
   favorito, personalização) vira evento anônimo que alimenta o painel do dono.
5. **Painéis híbridos** → o dono gerencia cardápio/esgotado/Wi-Fi/métricas no
   `/admin`; a equipe Bupin gerencia clientes, tags NFC, moderação de mídia e
   **leads da landing page** no `/super-admin`.

Stack: **Vite + React + TypeScript**, TanStack Router, Tailwind CSS v4,
Lucide, Supabase (Auth, Postgres + RLS, Storage) — deploy na Vercel.

## Rotas

| Rota | O quê |
| --- | --- |
| `/` | Landing page do produto (captura de leads → super admin) |
| `/c/:slug` | Cardápio do cliente (hub + feed + botão de garçom) |
| `/t/:tag` | Coringa NFC/QR → redireciona para o cardápio da mesa |
| `/auth` | Login (e-mail/senha; Google só em domínio Lovable) |
| `/admin` | Painel do dono do estabelecimento |
| `/super-admin` | Painel mestre da equipe Bupin |

## Banco (Supabase)

Tabelas centrais — RLS em tudo, super admin via `user_roles.has_role`:

| Tabela | Papel |
| --- | --- |
| `tenants` | Estabelecimentos (marca, Wi-Fi, Google, plano, dono) |
| `nfc_tags` | Cartões coringa: tag → cliente/mesa ou URL externa |
| `categories` / `products` | Cardápio (mídia, galeria, adicionais, esgotado) |
| `telemetry_events` | Gestos anônimos do cliente (atenção, swipes…) |
| `waiter_calls` | Chamadas de garçom/conta/gerente por mesa |
| `leads` | Contatos do formulário da landing page |

Migrations em `drizzle/migrations/` (aplique pela ordem no SQL Editor):
`0000` base → `0002` bucket de mídia → `0004` chamadas → `0005` métricas v2 →
`0006` **leads da LP** → `0007` **fix do trigger de novo usuário** (nunca pule) →
`0008` isolamento do storage por tenant → `0009` superfície pública (view/RPCs) →
`0010` trava das policies públicas (**só depois do deploy do código novo** —
ver HANDOFF seção 14).

## Desenvolvimento local

```sh
git clone https://github.com/regpark97/menu.git
cd menu
npm i
npm run dev
```

Variáveis de ambiente: copie `.env.example` → `.env` (URL + publishable key
do Supabase).

## Testes

```sh
npm run test        # roteamento e dashboard (vitest)
```

---

This project was built with [Lovable](https://lovable.dev).

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/cc7d8484-1214-47cb-a741-e85c5a75bdd6):

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.
