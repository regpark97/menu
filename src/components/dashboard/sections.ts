import type { LucideIcon } from "lucide-react";
import {
  Bell,
  UtensilsCrossed,
  Wifi,
  ImagePlus,
  BarChart3,
  Users,
  Tags,
  ImageIcon,
} from "lucide-react";

export type SectionItem = {
  key: string;
  label: string;
  icon: LucideIcon;
  /** Grupo (cabeçalho) a que a seção pertence na sidebar. */
  group: string;
};

/** Seções do painel do restaurante, agrupadas por contexto. */
export const ADMIN_SECTIONS: SectionItem[] = [
  { key: "calls", label: "Chamadas", icon: Bell, group: "Operação" },
  { key: "products", label: "Pratos", icon: UtensilsCrossed, group: "Cardápio" },
  { key: "wifi", label: "Wi-Fi e Google", icon: Wifi, group: "Cardápio" },
  { key: "branding", label: "Aparência", icon: ImagePlus, group: "Cardápio" },
  { key: "metrics", label: "Métricas", icon: BarChart3, group: "Análise" },
];

/** Seções do painel mestre. */
export const SUPER_SECTIONS: SectionItem[] = [
  { key: "tenants", label: "Clientes", icon: Users, group: "Gestão" },
  { key: "tags", label: "Tags NFC", icon: Tags, group: "Gestão" },
  { key: "moderation", label: "Moderação", icon: ImageIcon, group: "Operação" },
];

/** Agrupa as seções preservando a ordem de aparição dos grupos. */
export function groupSections(sections: SectionItem[]): { group: string; items: SectionItem[] }[] {
  const order: string[] = [];
  const map = new Map<string, SectionItem[]>();
  for (const s of sections) {
    if (!map.has(s.group)) {
      map.set(s.group, []);
      order.push(s.group);
    }
    map.get(s.group)!.push(s);
  }
  return order.map((group) => ({ group, items: map.get(group)! }));
}
