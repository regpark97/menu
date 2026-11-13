import { useState } from "react";
import { Bell, Receipt, UserRound, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMenuLanguage } from "@/hooks/use-menu-language";

type CallKind = "waiter" | "bill" | "manager";

const CALL_OPTIONS: { kind: CallKind; label: string; icon: typeof Bell }[] = [
  { kind: "waiter", label: "Chamar garçom", icon: Bell },
  { kind: "bill", label: "Pedir a conta", icon: Receipt },
  { kind: "manager", label: "Falar com o gerente", icon: UserRound },
];

/** Bolinha flutuante discreta com as opções de chamar a equipe. */
export function WaiterButton({
  tenantId,
  table,
}: {
  tenantId: string;
  table?: string | undefined;
}) {
  const { t } = useMenuLanguage();
  const labels: Record<CallKind, string> = {
    waiter: t("waiterTeam"),
    bill: t("waiterBill"),
    manager: t("waiterManager"),
  };
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState<CallKind | null>(null);
  const [cooldown, setCooldown] = useState(false);

  async function call(kind: CallKind) {
    if (sending || cooldown) return;
    setSending(kind);
    const { error } = await supabase.rpc("call_waiter", {
      _tenant: tenantId,
      _table: table ?? "",
      _kind: kind,
    });
    setSending(null);
    if (error) {
      if (error.message.includes("Aguarde")) {
        setCooldown(true);
        toast.error(t("waiterCooldown"));
      } else {
        toast.error(t("waiterError"));
      }
      return;
    }
    setOpen(false);
    setCooldown(true);
    toast.success(
      kind === "bill"
        ? t("waiterToastBill")
        : kind === "manager"
          ? t("waiterToastManager")
          : table
            ? t("waiterToastTable", table)
            : t("waiterToast"),
      { duration: 5000 },
    );
    setTimeout(() => setCooldown(false), 120_000);
  }

  return (
    <div className="fixed right-4 top-16 z-40 flex flex-col items-end gap-3">
      {open && (
        <div className="flex flex-col gap-2">
          {CALL_OPTIONS.map((o) => (
            <button
              key={o.kind}
              onClick={() => call(o.kind)}
              disabled={!!sending || cooldown}
              className="glass flex items-center gap-2 rounded-full py-2.5 pl-3 pr-4 text-sm font-medium shadow-lg active:scale-95 disabled:opacity-50"
            >
              {sending === o.kind ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <o.icon className="h-4 w-4 text-gold" />
              )}
              {labels[o.kind]}
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={t("waiterTeam")}
        className={`relative flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl transition active:scale-90 ${cooldown ? "opacity-60" : "animate-waiter-pulse"}`}
      >
        {open ? <X className="h-6 w-6" /> : <Bell className="h-6 w-6" />}
      </button>
    </div>
  );
}
