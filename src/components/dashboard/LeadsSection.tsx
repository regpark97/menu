import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Mail, Phone, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export type Lead = {
  id: number;
  establishment: string;
  owner: string;
  phone: string;
  email: string;
  segment: string;
  status: string;
  created_at: string;
};

const SEGMENTS: Record<string, string> = {
  cafe: "Cafeteria",
  restaurante: "Restaurante",
  bar: "Bar / Boteco",
  hamburgueria: "Hamburgueria",
  pizzaria: "Pizzaria",
  doceria: "Doceria",
  sorveteria: "Sorveteria",
  foodtruck: "Food truck",
  outro: "Outro",
};

const STATUS: Record<string, { label: string; next: string }> = {
  new: { label: "Novo", next: "contacted" },
  contacted: { label: "Contatado", next: "demo" },
  demo: { label: "Demo agendada", next: "closed" },
  closed: { label: "Fechado", next: "new" },
};

const STATUS_CLS: Record<string, string> = {
  new: "bg-warning/15 text-warning border-warning/40",
  contacted: "bg-primary/10 text-foreground border-border",
  demo: "bg-chart-3/15 text-chart-3 border-chart-3/40",
  closed: "bg-success/15 text-success border-success/40",
};

export function LeadsSection() {
  const { data, refetch, isLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: async () =>
      (await supabase.from("leads").select("*").order("created_at", { ascending: false })).data ??
      [],
  });

  const leads = data ?? [];
  const newCount = leads.filter((l) => l.status === "new").length;

  async function advance(lead: Lead) {
    const next = STATUS[lead.status]?.next ?? "contacted";
    const { error } = await supabase.from("leads").update({ status: next }).eq("id", lead.id);
    if (error) return toast.error(error.message);
    refetch();
  }

  if (isLoading) return null;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {leads.length} lead{leads.length === 1 ? "" : "s"} no total ·{" "}
        <span className="text-gold">{newCount} aguardando contato</span>
      </p>

      {leads.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-center text-muted-foreground">
          Nenhum lead ainda. Assim que alguém enviar o formulário da landing page, aparece aqui.
        </div>
      ) : (
        leads.map((l) => (
          <article key={l.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1">
                <h3 className="text-2xl leading-none">{l.establishment}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {l.owner} · {SEGMENTS[l.segment] ?? l.segment} ·{" "}
                  {new Date(l.created_at).toLocaleString("pt-BR")}
                </p>
              </div>
              <button
                onClick={() => advance(l)}
                title="Avançar status"
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${STATUS_CLS[l.status] ?? ""}`}
              >
                {STATUS[l.status]?.label ?? l.status} →
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={`mailto:${l.email}`}
                className="flex items-center gap-1 rounded-lg bg-secondary px-3 py-2 text-sm text-foreground hover:bg-accent"
              >
                <Mail className="h-4 w-4" /> {l.email}
              </a>
              <a
                href={`https://wa.me/55${l.phone.replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 rounded-lg bg-secondary px-3 py-2 text-sm text-foreground hover:bg-accent"
              >
                <Phone className="h-4 w-4" /> {l.phone}
              </a>
              <span className="flex items-center gap-1 rounded-lg bg-secondary/50 px-3 py-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" /> {SEGMENTS[l.segment] ?? l.segment}
              </span>
            </div>
          </article>
        ))
      )}
    </div>
  );
}
