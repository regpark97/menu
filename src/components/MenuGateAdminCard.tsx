import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { leadsToCsv } from "@/lib/leads-csv";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

/** Configuração da barreira de contato e consulta privada às captações do dono. */
export function MenuGateAdminCard({ tenant }: { tenant: Tables<"tenants"> }) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const { data: leads = [] } = useQuery({
    queryKey: ["menu-gate-leads", tenant.id],
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_gate_leads")
        .select("id,full_name,whatsapp,created_at")
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  async function toggle() {
    setSaving(true);
    const next = !tenant.menu_gate_enabled;
    const { error } = await supabase
      .from("tenants")
      .update({ menu_gate_enabled: next })
      .eq("id", tenant.id);
    if (error) toast.error(error.message);
    else {
      toast.success(next ? "Captação ativada" : "Captação desativada");
      await qc.invalidateQueries({ queryKey: ["my-tenant"] });
    }
    setSaving(false);
  }

  function exportCsv() {
    const blob = new Blob([leadsToCsv(leads)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `contatos-${tenant.slug}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <section className="glass space-y-4 rounded-2xl p-4">
      <div className="flex items-center gap-2">
        <LockKeyhole className="h-5 w-5 text-gold" />
        <h2 className="text-lg text-muted-foreground">Captação pelo cardápio</h2>
      </div>
      <div className="flex items-start justify-between gap-4 rounded-xl bg-secondary p-3">
        <div>
          <p className="font-medium">Desbloquear cardápio</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Antes de explorar, o cliente informa nome completo e WhatsApp. Desativado, o cardápio
            abre direto.
          </p>
        </div>
        <Switch
          checked={tenant.menu_gate_enabled}
          disabled={saving}
          onCheckedChange={() => void toggle()}
          aria-label="Ativar captação antes do cardápio"
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium">Contatos recentes</h3>
        <Button variant="outline" size="sm" disabled={leads.length === 0} onClick={exportCsv}>
          <Download className="h-4 w-4" /> Baixar CSV
        </Button>
      </div>
      {leads.length === 0 ? (
        <p className="rounded-xl bg-secondary p-4 text-sm text-muted-foreground">
          Nenhum contato captado ainda. Após o envio do formulário, nome e WhatsApp aparecem aqui.
        </p>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {leads.slice(0, 10).map((lead) => (
            <div
              key={lead.id}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm"
            >
              <div>
                <p className="font-medium">{lead.full_name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{lead.whatsapp}</p>
              </div>
              <time className="text-xs text-muted-foreground" dateTime={lead.created_at}>
                {new Date(lead.created_at).toLocaleDateString("pt-BR")}
              </time>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
