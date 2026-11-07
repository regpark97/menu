import { useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ThemeToggle } from "./ThemeToggle";
import { DashboardSidebar } from "./DashboardSidebar";
import type { SectionItem } from "./sections";

/**
 * Layout de dashboard: sidebar fixa à esquerda (desktop) e drawer no mobile,
 * com topbar contendo o título da página e o toggle de tema claro/escuro.
 */
export function DashboardLayout({
  variant,
  title,
  subtitle,
  sections,
  activeSection,
  onSectionChange,
  menuHref,
  headerExtra,
  children,
}: {
  variant: "admin" | "super";
  title: string;
  subtitle?: ReactNode | undefined;
  sections: SectionItem[];
  activeSection: string;
  onSectionChange: (key: string) => void;
  menuHref?: { slug: string } | undefined;
  headerExtra?: ReactNode | undefined;
  children: ReactNode;
}) {
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebar = (
    <DashboardSidebar
      variant={variant}
      sections={sections}
      activeSection={activeSection}
      onSectionChange={onSectionChange}
      menuHref={menuHref}
      onNavigate={() => setMobileOpen(false)}
    />
  );

  return (
    <div className="min-h-dvh bg-background">
      {/* Sidebar fixa no desktop */}
      {!isMobile && (
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-sidebar-border md:block">
          {sidebar}
        </aside>
      )}

      {/* Drawer no mobile */}
      {isMobile && (
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-64 border-sidebar-border p-0">
            {sidebar}
          </SheetContent>
        </Sheet>
      )}

      {/* Área de conteúdo */}
      <div className="md:pl-64">
        <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-md">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            {isMobile && (
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                aria-label="Abrir menu"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <Menu className="h-5 w-5" />
              </button>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-display text-xl leading-tight text-foreground">
                {title}
              </h1>
              {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
            </div>
            <div className="flex items-center gap-1">
              {headerExtra}
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
