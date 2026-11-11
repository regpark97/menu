# 🔐 Segurança & UX — 10/11/2026 (noite)

Sessão de auditoria + correções em produção. Tudo verificado e aplicado.

---

## 1. Auditoria completa (relatório: `docs/AUDITORIA-2026-11-10.md`)

12 achados (1 crítico, 2 altos, 5 médios, 4 baixos). Principais:

| ID | Achado | Severidade |
|---|---|---|
| C1 | Bucket `media` sem isolamento por tenant (dono A apaga mídia do dono B) | 🔴 |
| C2 | `nfc_tags` legível por anon com `using (true)` — enumeração de tags | 🟠 |
| C3 | `tenants` expunha `wifi_password`/plan/owner para qualquer anon | 🟠 |
| M1–M5 | leads sem anti-spam, telemetria sem TTL, listener leak, service role fora do `.env.example` | 🟡 |
| B1–B4 | `dangerouslySetInnerHTML` hardcoded, senha demo, 1 teste só, docs atrasadas | ⚪ |

## 2. Correções aplicadas (commits `e646a0f` → `5b254e4`)

### Segurança (C1–C3) — migrations + código

| Migration | O que faz | Status |
|---|---|---|
| `0008_storage_tenant_isolation.sql` | Policies do bucket `media` exigem prefixo = tenant do usuário | ✅ rodada |
| `0009_public_surface.sql` | View `public_menu` (sem wifi_password) + RPCs `tenant_wifi` / `resolve_tag` | ✅ rodada |
| `0010_lock_public_policies.sql` | Remove leitura anon direta de tenants/nfc_tags/categories/products; telemetria via helper `tenant_is_active` | ✅ rodada |

Código: `c.$slug.tsx` (views + RPC wifi), `t.$tag.tsx` (RPC resolve_tag), `types.ts`
(+ `leads`, views, RPCs — regen oficial pendente: `supabase gen types`).

**Sequência cumprida:** 0008+0009 → deploy → verificação em produção → 0010.

### UX da landing page (mobile)

| Problema | Correção |
|---|---|
| Texto a 0px da borda (mobile) | `.blp-wrap` com padding 32/36px (commits `c2a2145`) |
| Logo "B" invisível | `color: accent` sobre `background: accent` → `accent-ink` |
| Nav mobile estourada (logo+Entrar+CTA+tema) | Esconde Entrar/CTA na barra; logo 32px; barra 60px |
| Botão do hero gigante | CTAs empilhados, largura total, 44px de altura |
| Marquee encostado no mockup | 24px de respiro + margens |

Tudo medido com Playwright (viewport iPhone 390px): margens 36px, sem overflow
horizontal, logo visível, gap 24px.

## 3. Verificações finais

- Deploy confirmado por hash de asset novo (`index-nmxjuP0v.css`, 11/11 ~00:07)
- Rotas 200: `/`, `/c/territorio-mexicano`, `/auth`
- `wifi_password` ausente do HTML servido ✅
- tsc: 0 erros novos (3 pré-existentes: index.tsx:139/167 e admin.tsx:395)
- vitest: 3 passed

## 4. Pendências remanescentes

| Item | Onde |
|---|---|
| Reset senha Postgres (se não feito) | Supabase → Settings → Database |
| Anti-spam leads (M1) | RPC `submit_lead` com rate limit |
| TTL telemetria (M2) | cron de purge > 90 dias |
| `.env` local (dev não roda sem ele) | copiar do PC antigo / dashboard |
| Regenerar types.ts oficial | `npx supabase gen types` |
| Senha Wi-Fi demo se for real (B2) | trocar no roteador + banco |
