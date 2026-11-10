# BUPIN — Landing Page

Landing page do BUPIN: cardápio vertical ativado por NFC, com Customer Hub (Wi-Fi + Google
Reviews) e métricas de atenção por prato.

Este diretório contém **duas versões** da mesma LP:

| Versão | Onde | Uso |
| --- | --- | --- |
| **Estática** | `index.html` | Abrir direto no navegador, hospedar standalone (Netlify/Vercel estático) |
| **Integrada (React)** | `port/` | Portar para dentro do projeto `menu` (Vite + TanStack Router) como rota `/` |

---

## Versão estática (`index.html`)

Arquivo único e autônomo — só precisa da pasta `videos/` ao lado.

```
bupin-lp/
  index.html                    ← a LP completa (HTML + CSS + JS inline)
  videos/                       ← vídeos do mockup do celular
    asada.mp4       (2.79 MB)   Taco de Asada
    camarao.mp4     (6.38 MB)   Burrito de Camarão
    pescado.mp4     (2.80 MB)   Taco de Pescado
    chimichanga.mp4 (3.61 MB)   Chimichanga
  images/                       ← fotos de exemplo (não usadas na versão atual)
    hero.jpg, focaccia.jpg, focaccia2.jpg, coldbrew.jpg, matcha.jpg
  logo.png, logo-quadrado.png   ← logo da marca (referência de paleta)
  INTEGRACAO-SUPER-ADMIN.md     ← guia: tabela leads + aba Leads no super admin
  port/                         ← versão React pronta para o projeto
  README.md                     ← este arquivo
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

## Versão React (`port/`)

Arquivos prontos para colar no projeto `menu` (regpark97/menu):

```
port/
  src/routes/index.tsx    ← substitui o src/routes/index.tsx do projeto
  src/routes/lp.css       ← importado pelo index.tsx (namespaced .bupin-lp)
```

### Passo a passo

1. **Vídeos:** copie `bupin-lp/videos/` para `public/landing/videos/` no projeto:
   ```
   menu/public/landing/videos/asada.mp4
   menu/public/landing/videos/camarao.mp4
   menu/public/landing/videos/pescado.mp4
   menu/public/landing/videos/chimichanga.mp4
   ```

2. **Rotas:** substitua `menu/src/routes/index.tsx` pelo conteúdo de
   `port/src/routes/index.tsx` e copie `port/src/routes/lp.css` para o mesmo lugar.

3. **Supabase:** crie a tabela `leads` (SQL em `INTEGRACAO-SUPER-ADMIN.md`). O formulário
   já usa `supabase.from("leads").insert(...)` via `@/integrations/supabase/client` —
   mesma instância do app.

4. **Tema:** a LP é 100% self-contained (`.bupin-lp` com variáveis `--blp-*`), não
   conflita com o Tailwind v4/shadcn do projeto. O tema claro/escuro do app não afeta a
   LP (ela mantém o dark chocolate da marca).

5. **Import do `lucide-react`** e `@tanstack/react-router` já existem no projeto.

### O que mudou da estática para a React

- Ícones SVG inline → componentes `lucide-react` (já usados no projeto).
- JS de scroll/reveal/form → hooks (`useReveal`, `useNavScroll`, `useBarsAnimation`,
  `PhoneMockup` com estado de categoria ativa).
- Formulário envia direto pro Supabase (sem fetch manual com anon key).
- Botão discreto **"Entrar"** no nav e rodapé → `/auth` (login único que já encaminha
  admin/super-admin conforme a conta — nada de botões grandes de painel na homepage).
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
