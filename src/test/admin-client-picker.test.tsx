import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: { component: React.ComponentType }) => ({
    options,
    useSearch: () => ({ tenant: undefined }),
    useNavigate: () => () => {},
  }),
  Link: ({
    children,
    to,
    search,
  }: {
    children: React.ReactNode;
    to: string;
    search?: { tenant?: string };
  }) => <a href={search?.tenant ? `${to}?tenant=${search.tenant}` : to}>{children}</a>,
  useNavigate: () => () => {},
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: async () => ({ data: { user: { id: "super-user-id" } } }),
      signOut: async () => ({}),
    },
    from: (table: string) => {
      const builder: Record<string, unknown> = {};
      builder.select = () => builder;
      builder.eq = () => builder;
      builder.limit = () => builder;
      builder.maybeSingle = async () => ({ data: null });
      builder.order = async () => ({
        data:
          table === "tenants"
            ? [
                { id: "a", name: "Acre Café", slug: "acre-cafe" },
                { id: "b", name: "Café da Ana", slug: "cafe-da-ana" },
              ]
            : [],
        error: null,
      });
      builder.then = (resolve: (result: unknown) => unknown) =>
        Promise.resolve({ data: [{ role: "super_admin" }], error: null }).then(resolve);
      return builder;
    },
  },
}));

import { ThemeProvider } from "@/hooks/use-theme";
import { Route } from "@/routes/_authenticated/admin";

describe("Seleção explícita de cliente pelo Super Admin", () => {
  it("mostra a lista, filtra e liga cada cliente ao próprio id", async () => {
    const Component = Route.options.component as React.ComponentType;
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <Component />
        </ThemeProvider>
      </QueryClientProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: "Qual cliente você quer gerenciar?" }),
    ).toBeInTheDocument();
    const ana = screen.getByRole("link", { name: /Café da Ana/ });
    expect(ana).toHaveAttribute("href", "/admin?tenant=b");

    fireEvent.change(screen.getByLabelText("Filtrar clientes"), { target: { value: "ana" } });
    expect(screen.getByRole("link", { name: /Café da Ana/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Acre Café/ })).not.toBeInTheDocument();
  });
});
