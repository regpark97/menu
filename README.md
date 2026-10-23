# Sipflow Tabletales

Quero construir um micro-SaaS completo chamado "SipFlow Clone" — uma plataforma de cardápio interativo vertical (estilo TikTok/Reels) ativado por NFC/QR Code na mesa, com Customer Hub (Wi-Fi e Google Reviews), coleta de telemetria comportamental (tempo de atenção por prato) e gestão híbrida (Super Admin + Área do Loista com moderação de mídia).



Use: React / Next.js (ou Vite + React Router), Tailwind CSS, Lucide Icons, Supabase (Auth, Database Postgres e Storage).



---



### 1. MODELAGEM DO BANCO DE DADOS (SUPABASE)



Crie as migrations SQL para as seguintes tabelas:



1. `tenants` (Estabelecimentos):

   - `id` (uuid, PK)

   - `owner_user_id` (uuid, FK para auth.users)

   - `slug` (text, unique) — ex: "francisco-porto"

   - `name` (text), `tagline` (text), `logo_url` (text), `bg_image_url` (text)

   - `wifi_ssid` (text), `wifi_password` (text), `google_review_url` (text)

   - `plan` (text: 'essential' | 'pro' | 'signature')

   - `active` (boolean, default true)

   - `created_at` (timestamptz)



2. `nfc_tags` (Sistema de Links Coringas / Redirecionamento Dinâmico):

   - `id` (uuid, PK)

   - `tag_code` (text, unique) — ex: "tag-001" (gravado fisicamente no cartão NFC)

   - `tenant_id` (uuid, FK para tenants, nullable)

   - `table_label` (text) — ex: "04" ou "Varanda 2"

   - `custom_redirect_url` (text, nullable) — se preenchido, redireciona para URL externa em vez do cardápio padrão

   - `active` (boolean, default true)



3. `categories`:

   - `id` (uuid, PK), `tenant_id` (uuid, FK), `name` (text), `sort_order` (int)



4. `products`:

   - `id` (uuid, PK), `tenant_id` (uuid, FK), `category_id` (uuid, FK)

   - `name` (text), `description` (text, limite 180 chars)

   - `price_cents` (int)

   - `media_url` (text), `media_type` ('image' | 'video')

   - `pending_media_url` (text, nullable), `pending_media_type` (text, nullable), `moderation_status` ('approved' | 'pending' | 'rejected', default 'approved')

   - `modifiers` (jsonb) — lista de grupos de adicionais, ex: `[{"group": "Leite", "options": [{"name": "Leite de Aveia", "price_cents": 400}]}]`

   - `is_available` (boolean, default true) — botão rápido de "Esgotado"

   - `is_featured` (boolean, default false)

   - `sort_order` (int)



5. `telemetry_events`:

   - `id` (bigint, PK), `tenant_id` (uuid, FK), `session_id` (uuid), `table_ref` (text)

   - `event_type` (text: 'session_start', 'product_view', 'swipe', 'category_change', 'favorite', 'customize_open', 'wifi_open', 'review_click')

   - `product_id` (uuid, nullable), `category_id` (uuid, nullable)

   - `duration_ms` (int, nullable) — tempo de atenção em milissegundos

   - `metadata` (jsonb), `created_at` (timestamptz)



Crie também uma View SQL `product_intelligence_view` que agrupe por `product_id` e retorne: total de visualizações (`product_view`), tempo médio de atenção em segundos (`ROUND(AVG(duration_ms)/1000.0, 1)`), total de favoritos e total de aberturas de personalização.



---



### 2. ROTA CORINGA DO CARTÃO NFC (`/t/[tag_code]`)



- Quando um cliente encostar o celular no cartão NFC, ele abrirá `seusite.com/t/tag-001`.

- Essa rota busca `tag-001` na tabela `nfc_tags`:

  - Se `custom_redirect_url` estiver preenchido, redireciona imediatamente para lá.

  - Caso contrário, redireciona para `/c/[tenant.slug]?t=[table_label]`.

- Isso garante que os cartões físicos nunca precisem ser regravados se o cliente mudar de link ou nome.



---



### 3. EXPERIÊNCIA DO CLIENTE NA MESA (`/c/[slug]`) — MOBILE-FIRST DARK LUXURY



Desenhe para parecer um app nativo sofisticado (fundo preto `#09090b`, vidro fosco `backdrop-blur-md`, tipografia serifada elegante nos títulos dos pratos e sans-serif limpa na UI):



1. **Tela 1: Customer Hub (Boas-vindas)**:

   - Imagem/vídeo de fundo em tela cheia com overlay escuro gradiente.

   - Indicador discreto no topo: "Mesa [t]".

   - Logo centralizada, nome do café e frase de impacto (`tagline`).

   - 3 Botões grandes na parte inferior:

     - **"Explorar Cardápio →"** (Branco sólido, abre o Discover Feed).

     - **"Avaliar no Google ↗"** (Translúcido, registra evento `review_click` e abre `google_review_url`).

     - **"Conectar ao Wi-Fi ›"** (Translúcido, registra `wifi_open` e abre um modal elegante na parte inferior mostrando Rede, Senha e botão "Copiar Senha" com feedback visual).



2. **Tela 2: Discover Feed (Estilo TikTok/Reels)**:

   - Scroll vertical em tela cheia (`h-dvh overflow-y-scroll snap-y snap-mandatory`). Mostra apenas produtos onde `is_available = true`.

   - Barra superior fixa com gradiente escuro e pílulas horizontais das Categorias.

   - Cada produto ocupa 100% da altura da tela (`snap-start snap-always`), com foto ou vídeo em loop automático (`autoPlay muted loop playsInline`).

   - Rodapé do card com nome grande, descrição curta, pílula de preço formatada em R$ (ou €), botão **"Personalizar +"** (se houver `modifiers`) e botão de **Coração (Favoritar)**.

   - **Gaveta "Deixe do seu jeito" (Bottom Sheet):** Ao clicar em "Personalizar +", abre um modal deslizante onde o cliente testa adicionais (ex: Leite de Aveia +R$ 4,00, Shot Extra +R$ 5,00), vê o preço total somando ao vivo e gera eventos de telemetria sobre quais adicionais são mais desejados.



3. **Motor Invisível de Telemetria (`IntersectionObserver`)**:

   - Gere um `session_id` no `sessionStorage`.

   - Use `IntersectionObserver` (threshold 0.65) em cada card do feed. Cronometre com `performance.now()` o momento em que o produto entra em foco até o momento em que sai (ou quando a aba é minimizada via `visibilitychange`).

   - Se o tempo ficar entre 400ms e 120.000ms (filtra scroll acidental e celular esquecido aberto), envie o evento `product_view` com `duration_ms` em lote para o Supabase.



---



### 4. ÁREA DO CLIENTE — PAINEL DO DONO DO RESTAURANTE (`/admin`)



Painel intuitivo e à prova de erros para o dono do restaurante gerenciar a operação sem quebrar o design:



1. **Aba "Cardápio Rápido" (Autonomia Instantânea):**

   - Lista de produtos com **Switch grande de "Disponível / Esgotado" (`is_available`)** que atualiza em tempo real com 1 toque pelo celular.

   - Edição direta de Preço (com máscara de moeda e trava contra preço zero) e Descrição (com contador rígido de 180 caracteres para nunca quebrar o layout mobile).

   - Edição rápida da senha do Wi-Fi.

2. **Upload de Fotos com Moderação de Qualidade:**

   - Quando o dono do restaurante envia uma nova foto ou vídeo para um prato, salve em `pending_media_url` e mude `moderation_status` para `'pending'`.

   - Mostre um aviso amigável: *"Sua nova foto foi enviada e entrará no ar assim que nossa equipe validar o enquadramento"*. O cardápio público continua exibindo a foto antiga aprovada até o Super Admin aprovar.

3. **Aba "Inteligência & Métricas":**

   - Cards no topo: Total de Sessões Abertas, Visualizações de Pratos, Cliques no Google Review e Aberturas de Wi-Fi (com filtro de 7, 15 e 30 dias).

   - **Tabela de Atenção por Produto:** Lista os pratos ordenados por Tempo Médio de Atenção (ex: `19.7s`), Views, Favoritos e Aberturas de Personalização, destacando em verde os itens com alta atenção (oportunidade de destaque/margem).



---



### 5. PAINEL MESTRE — SUPER ADMIN (`/super-admin`)



Visão exclusiva do dono do SaaS:

1. **Gestão de Clientes (Tenants):** Criar novo estabelecimento, definir plano, editar logo/fundo e botão **"Acessar Painel do Cliente"** (impersonation) para dar suporte rápido.

2. **Gerenciador de Tags NFC (`/t/[tag_code]`):** Criar lotes de códigos (`tag-001` a `tag-050`), vincular a qual restaurante e mesa pertencem, ou apontar para um link externo caso necessário, além de botão para copiar o link ou baixar QR Code de fallback.

3. **Fila de Moderação de Fotos:** Lista todas as fotos/vídeos enviados pelos clientes que estão com `moderation_status = 'pending'`, comparando "Foto Atual vs. Foto Nova", com botões **"Aprovar (Publicar)"** e **"Recusar"**.



Inclua dados de demonstração pré-populados (baseados na cafeteria "Francisco Coffee Shop" com Focaccias, Iced Strawberry Matcha e Cold Bre

w Tonic) para que eu possa testar a experiência do cliente, o painel do restaurante e o Super Admin imediatamente.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/cc7d8484-1214-47cb-a741-e85c5a75bdd6).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
