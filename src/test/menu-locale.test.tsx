import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Tables } from "@/integrations/supabase/types";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: { component: React.ComponentType }) => ({
    options,
    useParams: () => ({ slug: "cantina" }),
    useSearch: () => ({}),
  }),
}));

vi.mock("@/lib/telemetry", () => ({ initTelemetry: vi.fn(), track: vi.fn() }));

const tenant = {
  id: "t1",
  slug: "cantina",
  name: "Cantina Verde",
  tagline: null,
  logo_url: null,
  bg_image_url: null,
  wifi_ssid: null,
  google_review_url: null,
} as Tables<"public_menu">;
const categories = [
  { id: "c1", tenant_id: "t1", name: "Bebidas", sort_order: 1 },
] as Tables<"public_menu_children">[];
const products = [
  {
    id: "p1",
    tenant_id: "t1",
    category_id: "c1",
    name: "Café da casa",
    description: "Leite fresco",
    price_cents: 1300,
    is_featured: false,
    is_available: true,
    media_url: "/hero.jpg",
    media_type: "image",
    media_gallery: [],
    modifiers: [{ group: "Tamanho", options: [{ name: "Grande", price_cents: 200 }] }],
    sort_order: 1,
  },
] as Tables<"public_menu_products">[];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const result = {
        select: () => result,
        eq: () => result,
        order: async () => ({ data: table === "public_menu_products" ? products : categories }),
        maybeSingle: async () => ({ data: table === "public_menu" ? tenant : null }),
      };
      return result;
    },
  },
}));

const translated: Record<string, string> = {
  Bebidas: "Drinks",
  "Café da casa": "Breakfast coffee",
  "Leite fresco": "Fresh milk",
  Tamanho: "Size",
  Grande: "Large",
};

vi.stubGlobal(
  "IntersectionObserver",
  class {
    observe() {}
    disconnect() {}
    unobserve() {}
  },
);

import { Route } from "@/routes/c.$slug";

function screenMenu() {
  const Component = Route.options.component as React.ComponentType;
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <Component />
    </QueryClientProvider>,
  );
}

describe("Cardápio multilíngue", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const text = new URL(String(input)).searchParams.get("q") ?? "";
      return {
        ok: true,
        json: async () => ({
          responseData: { translatedText: translated[text] ?? text },
          responseStatus: 200,
        }),
      } as Response;
    });
  });

  it("troca a UI e traduz os pratos/opções sem mudar o cálculo", async () => {
    screenMenu();
    await screen.findByRole("button", { name: "Explorar cardápio" });
    fireEvent.click(screen.getByRole("button", { name: /Idioma/ }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "English" }));
    expect(screen.getByRole("button", { name: "Explore menu" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Explore menu" }));
    expect(await screen.findByText("Breakfast coffee")).toBeInTheDocument();
    expect(screen.getByText("Fresh milk")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Customize" }));
    fireEvent.click(await screen.findByRole("button", { name: /Large/ }));

    expect(screen.getByText("Make it your own")).toBeInTheDocument();
    expect(screen.getByText("R$15.00")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Call the team" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Language: English" }));
    expect(screen.getByRole("menu")).toHaveStyle({ right: "5.5rem" });
  });
});
