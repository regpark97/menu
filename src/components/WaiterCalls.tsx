import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Bell, Receipt, UserRound, Check, BellRing } from "lucide-react";

const KIND_INFO: Record<string, { label: string; icon: typeof Bell }> = {
  waiter: { label: "Chamou o garçom", icon: Bell },
  bill: { label: "Pediu a conta", icon: Receipt },
  manager: { label: "Chamou o gerente", icon: UserRound },
};

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `há ${diff}s`;
  const min = Math.floor(diff / 60);
  return `há ${min} min`;
}

/** Lista em tempo real das chamadas pendentes do estabelecimento. */
export function WaiterCalls({ tenantId }: { tenantId: string }) {
  const qc = useQueryClient();
  const [, setTick] = useState(0);
  const soundRef = useRef(false);
  const seenRef = useRef<Set<string>>(new Set());

  const { data: calls } = useQuery({
    queryKey: ["waiter-calls", tenantId],
    queryFn: async () =>
      (
        await supabase
          .from("waiter_calls")
          .select("*")
          .eq("tenant_id", tenantId)
          .eq("status", "pending")
          .order("created_at", { ascending: true })
      ).data ?? [],
    refetchInterval: 15_000,
  });

  // Realtime: escuta novas chamadas deste tenant.
  useEffect(() => {
    const channel = supabase
      .channel(`waiter-calls-${tenantId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "waiter_calls", filter: `tenant_id=eq.${tenantId}` },
        () => qc.invalidateQueries({ queryKey: ["waiter-calls", tenantId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, qc]);

  // Atualiza o "há Xs" a cada 15s.
  useEffect(() => {
    const id = setInterval(() => setTick((v) => v + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  // Toca um bipe quando chega uma chamada nova.
  useEffect(() => {
    if (!calls) return;
    const pend = calls.map((c) => c.id);
    const isNew = pend.some((id) => !seenRef.current.has(id));
    pend.forEach((id) => seenRef.current.add(id));
    if (isNew && soundRef.current) {
      try {
        const ctx = new (
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        )();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
      } catch {
        // navegador bloqueou o audio - ignora
      }
    }
  }, [calls]);

  async function attend(c: Tables<"waiter_calls">) {
    const { error } = await supabase
      .from("waiter_calls")
      .update({ status: "done", done_at: new Date().toISOString() })
      .eq("id", c.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["waiter-calls", tenantId] });
  }

  return (
    <section className="glass space-y-3 rounded-2xl p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BellRing className="h-5 w-5 text-gold" />
          <h2 className="text-lg text-muted-foreground">Chamadas da mesa</h2>
          {!!calls?.length && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-bold text-destructive-foreground">
              {calls.length}
            </span>
          )}
        </div>
        <button
          onClick={() => {
            soundRef.current = !soundRef.current;
            setTick((v) => v + 1);
            toast.success(soundRef.current ? "Som ativado" : "Som desativado");
          }}
          className={`rounded-full px-3 py-1 text-xs ${soundRef.current ? "bg-primary text-primary-foreground" : "glass"}`}
        >
          {soundRef.current ? "Som ligado" : "Ativar som"}
        </button>
      </div>

      {!calls?.length ? (
        <p className="text-sm text-muted-foreground">Nenhuma chamada no momento.</p>
      ) : (
        <div className="space-y-2">
          {calls.map((c) => {
            const info = KIND_INFO[c.kind] ?? { label: "Chamou o garçom", icon: Bell };
            const Icon = info.icon;
            return (
              <div
                key={c.id}
                className="flex items-center gap-3 rounded-xl border border-warning/40 bg-warning/10 p-3"
              >
                <Icon className="h-5 w-5 shrink-0 text-warning" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {c.table_ref ? `Mesa ${c.table_ref}` : "Sem mesa"} · {info.label}
                  </p>
                  <p className="text-xs text-muted-foreground">{timeAgo(c.created_at)}</p>
                </div>
                <Button size="sm" onClick={() => attend(c)} className="shrink-0 gap-1">
                  <Check className="h-4 w-4" /> Atendido
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
