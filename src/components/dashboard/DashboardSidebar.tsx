import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, ShieldCheck, ExternalLink, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useIsSuperAdmin, usePendingModerationCount } from "@/components/AppHeader";
import type { SectionItem } from "./sections";
import { groupSections } from "./sections";

const baseItem =
  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors";
const idleItem =
  "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground";
const activeItem = "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm";

function NavBadge({ count }: { count: number }) {
  return (
    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function DashboardSidebar({
  variant,
  sections,
  activeSection,
  onSectionChange,
  menuHref,
  onNavigate,
}: {
  variant: "admin" | "super";
  sections: SectionItem[];
  activeSection: string;
  onSectionChange: (key: string) => void;
  menuHref?: { slug: string } | undefined;
  onNavigate?: (() => void) | undefined;
}) {
  const { data: isSuper } = useIsSuperAdmin();
  const { data: pendingCount } = usePendingModerationCount(!!isSuper);

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Marca */}
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-5">
        <Link to="/" onClick={onNavigate} aria-label="Bupin — início">
          <img src="/logo-quadrado.png" alt="Bupin" className="h-9 w-9 object-contain" />
        </Link>
        <span className="font-display text-lg text-sidebar-foreground">
          {variant === "super" ? "Mestre" : "Painel"}
        </span>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {/* Navegação de topo */}
        <div className="space-y-1">
          <Link
            to="/admin"
            onClick={onNavigate}
            className={cn(baseItem, variant === "admin" ? activeItem : idleItem)}
          >
            <LayoutDashboard className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-left">Painel do Restaurante</span>
          </Link>
          {isSuper && (
            <Link
              to="/super-admin"
              onClick={onNavigate}
              className={cn(baseItem, variant === "super" ? activeItem : idleItem)}
            >
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left">Super Admin</span>
              {!!pendingCount && pendingCount > 0 && <NavBadge count={pendingCount} />}
            </Link>
          )}
        </div>

        {/* Seções contextuais, agrupadas */}
        {groupSections(sections).map(({ group, items }) => (
          <div key={group} className="space-y-1">
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {group}
            </p>
            {items.map((s) => {
              const Icon = s.icon;
              const active = activeSection === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => {
                    onSectionChange(s.key);
                    onNavigate?.();
                  }}
                  className={cn(baseItem, "w-full", active ? activeItem : idleItem)}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-left">{s.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Rodapé */}
      <div className="space-y-1 border-t border-sidebar-border p-3">
        {menuHref && (
          <Link
            to="/c/$slug"
            params={{ slug: menuHref.slug }}
            search={{ t: undefined }}
            target="_blank"
            className={cn(baseItem, idleItem)}
          >
            <ExternalLink className="h-4 w-4 shrink-0" />
            Ver cardápio
          </Link>
        )}
        <SignOutButton />
      </div>
    </div>
  );
}

function SignOutButton() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  return (
    <button type="button" onClick={signOut} className={cn(baseItem, "w-full", idleItem)}>
      <LogOut className="h-4 w-4 shrink-0" />
      <span className="flex-1 text-left">Sair</span>
    </button>
  );
}
