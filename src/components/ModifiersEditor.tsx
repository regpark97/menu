import { Plus, Trash2, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatMoney, parseMoneyInput, type ModifierGroup } from "@/lib/format";

/**
 * Editor de adicionais (modifiers) de um prato.
 * Cada grupo vira um bloco no cardápio (ex.: "Leite", "Extras").
 * Cada opção tem nome + preço extra somado ao preço base.
 */
export function ModifiersEditor({
  value,
  onChange,
}: {
  value: ModifierGroup[];
  onChange: (next: ModifierGroup[]) => void;
}) {
  function updateGroup(gi: number, patch: Partial<ModifierGroup>) {
    onChange(value.map((g, i) => (i === gi ? { ...g, ...patch } : g)));
  }
  function removeGroup(gi: number) {
    onChange(value.filter((_, i) => i !== gi));
  }
  function addGroup() {
    onChange([...value, { group: "", options: [{ name: "", price_cents: 0 }] }]);
  }
  function addOption(gi: number) {
    onChange(
      value.map((g, i) =>
        i === gi ? { ...g, options: [...g.options, { name: "", price_cents: 0 }] } : g,
      ),
    );
  }
  function updateOption(
    gi: number,
    oi: number,
    patch: Partial<{ name: string; price_cents: number }>,
  ) {
    onChange(
      value.map((g, i) =>
        i === gi
          ? { ...g, options: g.options.map((o, j) => (j === oi ? { ...o, ...patch } : o)) }
          : g,
      ),
    );
  }
  function removeOption(gi: number, oi: number) {
    onChange(
      value.map((g, i) => (i === gi ? { ...g, options: g.options.filter((_, j) => j !== oi) } : g)),
    );
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 text-gold" />
        Adicionais (opcional) — habilita o botão “Personalizar +” no cardápio
      </div>

      {value.map((group, gi) => (
        <div key={gi} className="rounded-xl border border-border bg-background/40 p-3">
          <div className="flex items-center gap-2">
            <Input
              value={group.group}
              onChange={(e) => updateGroup(gi, { group: e.target.value })}
              maxLength={40}
              className="h-9 flex-1 text-sm font-medium"
              placeholder="Nome do grupo (ex.: Leite, Extras)"
              aria-label="Nome do grupo de adicionais"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 text-destructive"
              onClick={() => removeGroup(gi)}
              aria-label="Remover grupo"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-2 space-y-2">
            {group.options.map((opt, oi) => (
              <div key={oi} className="flex items-center gap-2">
                <Input
                  value={opt.name}
                  onChange={(e) => updateOption(gi, oi, { name: e.target.value })}
                  maxLength={40}
                  className="h-9 flex-1 text-sm"
                  placeholder="Ex.: Leite de Aveia"
                  aria-label="Nome da opção"
                />
                <Input
                  inputMode="numeric"
                  value={formatMoney(opt.price_cents)}
                  onChange={(e) =>
                    updateOption(gi, oi, { price_cents: parseMoneyInput(e.target.value) })
                  }
                  className="h-9 w-28 text-sm tabular-nums"
                  placeholder="+ R$ 0,00"
                  aria-label="Preço extra da opção"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 text-muted-foreground"
                  onClick={() => removeOption(gi, oi)}
                  disabled={group.options.length <= 1}
                  aria-label="Remover opção"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              className="h-8 gap-1 text-xs"
              onClick={() => addOption(gi)}
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar opção
            </Button>
          </div>
        </div>
      ))}

      <Button type="button" variant="outline" className="h-9 gap-1.5 text-sm" onClick={addGroup}>
        <Plus className="h-4 w-4" /> Adicionar grupo de adicionais
      </Button>
    </div>
  );
}
