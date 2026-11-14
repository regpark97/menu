export type GateLeadRow = Pick<
  import("@/integrations/supabase/types").Tables<"menu_gate_leads">,
  "full_name" | "whatsapp" | "created_at"
>;

/** Protege planilhas contra fórmulas mesmo quando o texto digitado começa com =, +, -. */
function csvCell(value: string) {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function leadsToCsv(rows: GateLeadRow[]): string {
  const header = ["Nome", "WhatsApp", "Criado em"].map(csvCell).join(",");
  const values = rows.map((lead) =>
    [csvCell(lead.full_name), csvCell(lead.whatsapp), csvCell(lead.created_at)].join(","),
  );
  return "﻿" + [header, ...values].join("\r\n");
}
