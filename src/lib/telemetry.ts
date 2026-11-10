/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  TELEMETRIA — o motor invisível de inteligência do BUPIN
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  Como funciona (o ciclo de vida de um evento):
 *
 *   1. A rota /c/$slug chama `initTelemetry()` assim que o cardápio carrega,
 *      registrando tenant e mesa. Isso dispara um `session_start` — mas só
 *      uma vez por aba (flag no sessionStorage), para não inflar a métrica
 *      quando o cliente alterna entre o hub e o feed.
 *
 *   2. Conforme o cliente navega, `track()` enfileira eventos: views de
 *      pratos, swipes, troca de categoria, favoritos, personalizações,
 *      cliques em Wi-Fi/Google. Nada sai do celular na hora.
 *
 *   3. `flush()` drena a fila em lotes para a tabela `telemetry_events`:
 *      - de 4 em 4 segundos (timer), e
 *      - imediatamente quando a aba fica oculta (visibilitychange) — o
 *        cliente pode fechar o cardápio a qualquer momento, então os
 *        últimos gestos não podem esperar o próximo tick.
 *
 *   4. Se o envio falha (rede instável no salão), o lote VOLTA para a
 *      frente da fila e um retry é agendado (3s). Sem retrys infinitos:
 *      se a aba fechar, perde-se apenas o que estava na fila.
 *
 *  Filtro de atenção (`isValidAttention`): tempos entre 400ms e 120s são
 *  considerados atenção real. Isso descarta scroll acidental (< 400ms) e
 *  celular esquecido aberto em cima da mesa (> 120s) — os dois sujariam
 *  a métrica de tempo médio que o dono vê no painel.
 *
 *  Privacidade: não há identificação do cliente. Cada evento carrega apenas
 *  um `session_id` anônimo (uuid por aba), a mesa e o contexto do gesto.
 */

import { supabase } from "@/integrations/supabase/client";
import { isValidAttention } from "./format";

/** Todos os gestos que o sistema sabe medir. */
type EventType =
  | "session_start"   // abertura do cardápio (1x por aba)
  | "product_view"    // prato em foco ≥65% da tela, com duração de atenção
  | "swipe"           // rolagem entre pratos (frente/trás)
  | "category_change" // clique numa pílula de categoria
  | "favorite"        // coração ativado
  | "customize_open"  // abertura da gaveta "Deixe do seu jeito"
  | "wifi_open"       // abertura do modal de Wi-Fi
  | "review_click"    // clique em "Avaliar no Google"
  | "modifier_select" // adicional marcado/desmarcado na personalização
  ;

type Ctx = { tenantId: string; tableRef: string | null };

let ctx: Ctx | null = null;
let queue: Record<string, unknown>[] = [];
let timer: ReturnType<typeof setInterval> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

/** Session anônima: um uuid por aba (sessionStorage), reutilizada entre telas. */
export function getSessionId() {
  let id = sessionStorage.getItem("sf_session");
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem("sf_session", id);
  }
  return id;
}

/**
 * Liga o motor de telemetria para um estabelecimento/mesa.
 * Idempotente: múltiplas chamadas não duplicam timers nem session_start.
 */
export function initTelemetry(c: Ctx) {
  ctx = c;
  if (!timer) {
    timer = setInterval(flush, 4000);
    document.addEventListener("visibilitychange", () => {
      // Aba oculta = melhor momento para drenar: pode ser a última chance.
      if (document.visibilityState === "hidden") flush();
    });
  }
  // session_start apenas 1x por tenant/aba — flag separada por tenant porque
  // a mesma aba pode visitar cardápios diferentes (ex.: QR de outro café).
  const key = `sf_started_${c.tenantId}`;
  if (!sessionStorage.getItem(key)) {
    sessionStorage.setItem(key, "1");
    track("session_start");
  }
}

/**
 * Registra um gesto. Não envia nada sozinho (exceto eventos leves, que
 * valem o envio imediato); os product_views esperam o lote periódico.
 */
export function track(
  event_type: EventType,
  data: {
    product_id?: string;
    category_id?: string | null;
    duration_ms?: number;
    metadata?: Record<string, unknown>;
  } = {},
) {
  if (!ctx) return;
  // product_view só conta com duração dentro da janela de atenção válida.
  if (
    event_type === "product_view" &&
    (data.duration_ms == null || !isValidAttention(data.duration_ms))
  )
    return;
  queue.push({
    tenant_id: ctx.tenantId,
    session_id: getSessionId(),
    table_ref: ctx.tableRef,
    event_type,
    product_id: data.product_id ?? null,
    category_id: data.category_id ?? null,
    duration_ms: data.duration_ms != null ? Math.round(data.duration_ms) : null,
    metadata: data.metadata ?? {},
  });
  // Eventos de ação (cliques) são raros e valiosos: vão imediatamente.
  if (event_type !== "product_view") flush();
}

/**
 * Envia a fila inteira de uma vez. Em caso de erro de rede, o lote volta
 * para a frente da fila e é reenviado após 3s — no máximo 1 retry agendado
 * por vez para não criar uma máquina de metralhadora de requests.
 */
export async function flush() {
  if (!queue.length) return;
  const batch = queue;
  queue = [];
  const { error } = await supabase.from("telemetry_events").insert(batch as never);
  if (error) {
    console.warn("telemetry", error.message);
    queue = [...batch, ...queue]; // lote volta à frente, preservando a ordem
    if (!retryTimer) {
      retryTimer = setTimeout(() => {
        retryTimer = null;
        void flush();
      }, 3000);
    }
  }
}
