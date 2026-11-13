import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// O DashboardLayout usa Link/useNavigate do router e o supabase (via hooks do
// AppHeader). Isolamos tudo com mocks leves para testar só a renderização/estrutura.
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...rest }: { children?: React.ReactNode }) => <a {...rest}>{children}</a>,
  useNavigate: () => () => {},
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: null } }), signOut: async () => ({}) },
    from: () => ({
      select: () => ({
        eq: () => ({ length: 0 }),
      }),
    }),
  },
}));

import { ThemeProvider, useTheme } from "@/hooks/use-theme";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ADMIN_SECTIONS, SUPER_SECTIONS } from "@/components/dashboard/sections";

vi.mock("@/components/AppHeader", () => ({
  useIsSuperAdmin: () => ({ data: true }),
  usePendingModerationCount: () => ({ data: 3 }),
}));

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
}

function ThemeProbe() {
  const { theme } = useTheme();
  return <span data-testid="theme">{theme}</span>;
}

describe("Tema (claro/escuro)", () => {
  it("inicia no claro e não lança erro ao montar", () => {
    render(
      wrap(
        <ThemeProvider>
          <ThemeProbe />
        </ThemeProvider>,
      ),
    );
    expect(screen.getByTestId("theme").textContent).toBe("light");
  });
});

describe("Badge da fila de moderação", () => {
  it("mostra a contagem no Super Admin e também na seção Moderação", () => {
    render(
      wrap(
        <ThemeProvider>
          <DashboardLayout
            variant="super"
            title="Super Admin"
            sections={SUPER_SECTIONS}
            activeSection="leads"
            onSectionChange={() => {}}
          >
            <span>Conteúdo</span>
          </DashboardLayout>
        </ThemeProvider>,
      ),
    );
    expect(screen.getAllByLabelText("3 foto(s) aguardando moderação")).toHaveLength(2);
  });
});

describe("DashboardLayout", () => {
  it("renderiza o título, as seções e o toggle de tema sem quebrar", () => {
    render(
      wrap(
        <ThemeProvider>
          <DashboardLayout
            variant="admin"
            title="Francisco Coffee"
            subtitle="Gerencie seu cardápio"
            sections={ADMIN_SECTIONS}
            activeSection="calls"
            onSectionChange={() => {}}
          >
            <p>Conteúdo do painel</p>
          </DashboardLayout>
        </ThemeProvider>,
      ),
    );

    expect(screen.getByText("Francisco Coffee")).toBeInTheDocument();
    expect(screen.getByText("Conteúdo do painel")).toBeInTheDocument();
    // Grupos e seções da sidebar
    expect(screen.getByText("Operação")).toBeInTheDocument();
    expect(screen.getByText("Chamadas")).toBeInTheDocument();
    expect(screen.getByText("Pratos")).toBeInTheDocument();
    expect(screen.getByText("Wi-Fi e Google")).toBeInTheDocument();
    expect(screen.getByText("Aparência")).toBeInTheDocument();
    expect(screen.getByText("Métricas")).toBeInTheDocument();
    // Botão de tema presente (aria-label do ThemeToggle no modo claro -> "Ativar tema escuro")
    expect(screen.getByLabelText("Ativar tema escuro")).toBeInTheDocument();
  });
});
