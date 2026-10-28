import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function useIsSuperAdmin() {
  return useQuery({
    queryKey: ["is-super"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return false;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", u.user.id)
        .eq("role", "super_admin");
      return (data?.length ?? 0) > 0;
    },
  });
}

export function AppHeader({ title }: { title: string }) {
  const { data: isSuper } = useIsSuperAdmin();
  const qc = useQueryClient();
  const navigate = useNavigate();
  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
        <Link to="/" className="text-xs uppercase tracking-[0.3em] text-gold">
          Bupin
        </Link>
        <span className="font-display text-xl">{title}</span>
        <nav className="ml-auto flex items-center gap-1 text-sm">
          <Link
            to="/admin"
            className="rounded-lg px-3 py-1.5 text-muted-foreground hover:bg-secondary"
            activeProps={{ className: "text-foreground bg-secondary" }}
          >
            Painel
          </Link>
          {isSuper && (
            <Link
              to="/super-admin"
              className="rounded-lg px-3 py-1.5 text-muted-foreground hover:bg-secondary"
              activeProps={{ className: "text-foreground bg-secondary" }}
            >
              Super Admin
            </Link>
          )}
          <button
            onClick={signOut}
            className="rounded-lg p-2 text-muted-foreground hover:bg-secondary"
            aria-label="Sair"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </nav>
      </div>
    </header>
  );
}
