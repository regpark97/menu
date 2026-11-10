# BUPIN — Landing Page

Landing page do BUPIN: cardápio vertical ativado por NFC, com Customer Hub (Wi-Fi + Google
Reviews) e métricas de atenção por prato.

Este diretório contém **duas versões** da mesma LP:

| Versão | Onde | Uso |
| --- | --- | --- |
| **Integrada (React)** | `../src/routes/index.tsx` + `../src/routes/lp.css` | Rota `/` do app — a homepage oficial |
| **Estática** | `index.html` | Backup standalone: abrir no navegador ou hospedar separado |

---

## Versão estática (`index.html`)

Arquivo único e autônomo — os vídeos ficam em `../public/landing/videos/`
(servidos em `/landing/videos/` quando o app roda; ao abrir o `index.html`
localmente fora do app, use-o sob o mesmo servidor).

```
landing/
  index.html                    ← a LP completa (HTML + CSS + JS inline)
  INTEGRACAO-SUPER-ADMIN.md     ← guia: tabela leads + aba Leads no super admin
  README.md                     ← este arquivo

../public/landing/videos/       ← vídeos do mockup (compartilhados com a versão React)
  asada.mp4       (2.79 MB)     Taco de Asada
  camarao.mp4     (6.38 MB)     Burrito de Camarão
  pescado.mp4     (2.80 MB)     Taco de Pescado
  chimichanga.mp4 (3.61 MB)     Chimichanga
```

### Como usar

1. Abra `index.html` no navegador (funciona 100% offline, exceto fontes Google).
2. Para publicar: arraste a pasta inteira em https://app.netlify.com/drop ou hospede o
   diretório em qualquer servidor estático.

### O que tem dentro

- **Paleta da marca:** chocolate `#3A1F13` + bege areia `#D3BAA1` (extraídas da logo
  `logo.png` — `BUPIN` em Archivo Black-like, caixa alta, expandido).
- **Tipografia:** Fraunces (títulos display serif), Sora (UI), Archivo Black (wordmark).
- **Mockup de celular:** feed vertical estilo Reels com scroll-snap real, auto-scroll a
  cada 4,2s, vídeos em loop que só tocam no card visível, **barra de categorias
  sincronizada com o card em foco** (Taco de Asada → "Tacos", etc.), coração de
  favoritar que rola junto, preço "Personalizar +" sempre visíveis.
- **Restaurant fictício:** "La Cantina del Sol" (taquería) — dados de demonstração.
- **Formulário de leads:** nome do estabelecimento, proprietário, telefone (máscara BR),
  e-mail, segmento (select). Validação inline + tela de sucesso. Envia via `fetch` para
  `SUA_SUPABASE_URL/rest/v1/leads` — **o bloco de envio está comentado no JS**; enquanto
  isso, salva em `localStorage` (`bupin_leads`) para demonstração.
- **Dashboard mock:** estatísticas e gráfico de barras com tempo de atenção por prato
  (dados ilustrativos), animado ao entrar na viewport.
- **Detalhes:** reveal on scroll (IntersectionObserver), marquee, FAQ em `<details>`,
  seção de preço (R$ 297/mês + implementação variável), CTA "Entrar" → `/auth`.
- **Acessibilidade:** `prefers-reduced-motion` respeitado, aria-labels, skip para
  reduced-motion.

---

## Versão React (rota `/` do app)

A LP já está integrada como homepage do projeto `menu`:

```
src/routes/index.tsx    ← a landing page (rota /)
src/routes/lp.css       ← estilos namespaced (.bupin-lp, --blp-*)
public/landing/videos/  ← vídeos do mockup
```

- **Supabase:** o formulário usa `supabase.from("leads").insert(...)` — a tabela está na
  migration `drizzle/migrations/0006_leads.sql` (rode no SQL Editor do Supabase).
- **Tema:** a LP é 100% self-contained (`.bupin-lp` com variáveis `--blp-*`), não
  conflita com o Tailwind v4/shadcn do projeto. O tema claro/escuro do app não afeta a
  LP (ela mantém o dark chocolate da marca).
- Ícones via `lucide-react`; scroll/reveal/form em hooks (`useReveal`, `useNavScroll`,
  `useBarsAnimation`, `PhoneMockup` com categoria ativa sincronizada).
- Botão discreto **"Entrar"** no nav e rodapé → `/auth`.
- Head/SEO via TanStack `head()`.

---

## Fontes dos vídeos

Os 4 vídeos do mockup vieram do tenant de demonstração `territorio-mexicano` do Supabase
do próprio projeto (bucket `media`), baixados via API com a publishable key pública do
app. São conteúdo seu — uso livre na LP.

---

## Créditos / pendências

- **Contato real:** definir WhatsApp/Instagram/e-mail de vendas quando fechar.
- **Preço:** R$ 297/mês + implementação variável (valores de placeholder confirmados).
- **Slogan:** "Da mesa ao dashboard."
- **Lead source (opcional):** adicionar `?utm_source=` ou campo `source` no insert para
  rastrear de onde veio o lead.
