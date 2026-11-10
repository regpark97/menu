import { supabase } from "@/integrations/supabase/client";
import { isValidAttention } from "./format";

type EventType =
  | "session_start"
  | "product_view"
  | "swipe"
  | "category_change"
  | "favorite"
  | "customize_open"
  | "wifi_open"
  | "review_click"
  | "modifier_select";

type Ctx = { tenantId: string; tableRef: string | null };
let ctx: Ctx | null = null;
let queue: Record<string, unknown>[] = [];
let timer: ReturnType<typeof setInterval> | null = null;

export function getSessionId() {
  let id = sessionStorage.getItem("sf_session");
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem("sf_session", id);
  }
  return id;
}

export function initTelemetry(c: Ctx) {
  ctx = c;
  if (!timer) {
    timer = setInterval(flush, 4000);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush();
    });
  }
  const key = `sf_started_${c.tenantId}`;
  if (!sessionStorage.getItem(key)) {
    sessionStorage.setItem(key, "1");
    track("session_start");
  }
}

export function track(
  event_type: EventType,
  data: { product_id?: string; category_id?: string | null; duration_ms?: number; metadata?: Record<string, unknown> } = {},
) {
  if (!ctx) return;
  if (event_type === "product_view" && (data.duration_ms == null || !isValidAttention(data.duration_ms))) return;
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
  if (event_type !== "product_view") flush();
}

export async function flush() {
  if (!queue.length) return;
  const batch = queue;
  queue = [];
  const { error } = await supabase.from("telemetry_events").insert(batch as never);
  if (error) {
    console.warn("telemetry", error.message);
    // Uma tentativa de retry: devolve o lote à fila (mantendo a ordem) e agenda
    // um novo flush rápido. Perde-se no máximo o que estiver na fila se a aba fechar.
    queue = [...batch, ...queue];
    if (!retryTimer) {
      retryTimer = setTimeout(() => {
        retryTimer = null;
        void flush();
      }, 3000);
    }
  }
}

let retryTimer: ReturnType<typeof setTimeout> | null = null;
