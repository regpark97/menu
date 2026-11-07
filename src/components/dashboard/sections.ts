import type { LucideIcon } from "lucide-react";
import { UtensilsCrossed, Tags, ImageIcon, Users, BarChart3 } from "lucide-react";

export type SectionItem = { key: string; label: string; icon: LucideIcon };

/** Seções do painel do restaurante. */
export const ADMIN_SECTIONS: SectionItem[] = [
  { key: "menu", label: "Cardápio Rápido", icon: UtensilsCrossed },
  { key: "metrics", label: "Inteligência & Métricas", icon: BarChart3 },
];

/** Seções do painel mestre. */
export const SUPER_SECTIONS: SectionItem[] = [
  { key: "tenants", label: "Clientes", icon: Users },
  { key: "tags", label: "Tags NFC", icon: Tags },
  { key: "moderation", label: "Moderação", icon: ImageIcon },
];
