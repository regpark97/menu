import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Tables } from "@/integrations/supabase/types";
import { Feed } from "@/routes/c.$slug";
import { LanguageSelector } from "@/components/LanguageSelector";
import { MenuLanguageProvider, MenuContentProvider, useMenuLanguage } from "@/hooks/use-menu-language";
import { WaiterButton } from "@/components/WaiterButton";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/telemetry", () => ({ initTelemetry: vi.fn(), track: vi.fn() }));
vi.stubGlobal("IntersectionObserver", class {
  observe() {}
  disconnect() {}
  unobserve() {}
});

const categories = [{ id: "c1", tenant_id: "t1", name: "Bebidas", sort_order: 1 }] as Tables<"public_menu_children">[];
const products = [{
  id: "p1", tenant_id: "t1", category_id: "c1", name: "Café da casa", description: "Leite fresco",
  price_cents: 1300, is_featured: false, is_available: true, media_url: "/hero.jpg", media_type: "image",
  media_gallery: [], modifiers: [{ group: "Tamanho", options: [{ name: "Grande", price_cents: 200 }] }], sort_order: 1,
}] as Tables<"public_menu_products">[];

const translated: Record<string, string> = {
  Bebidas: "Drinks", "Café da casa": "Breakfast coffee", "Leite fresco": "Fresh milk", Tamanho: "Size", Grande: "Large",
};

function MenuFixture() {
  const { locale, setLocale } = useMenuLanguage();
  return (
    <>
      <LanguageSelector locale={locale} onChange={setLocale} />
      <Feed categories={categories} products={products} onBack={() => {}} />
      <WaiterButton tenantId="t1" />
    </>
  );
}

describe("Feed em inglês com tradução em cache", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("bupin-menu-locale", "en");
    localStorage.setItem("bupin-menu-mt-v1", JSON.stringify(Object.fromEntries(
      Object.entries(translated).map(([source, text]) => [`en:${source}`, text]),
    )));
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const text = new URL(String(input)).searchParams.get("q") ?? "";
      return { ok: true, json: async () => ({
        responseData: { translatedText: translated[text] ?? text }, responseStatus: 200,
      }) } as Response;
    });
  });

  it("traduz prato, opções e total sem cobrir o garçom", async () => {
    render(
      <MenuLanguageProvider>
        <MenuContentProvider categories={categories} products={products}>
          <MenuFixture />
        </MenuContentProvider>
      </MenuLanguageProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Language: English/ }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "English" }));
    expect(await screen.findByText("Breakfast coffee")).toBeInTheDocument();
    expect(screen.getByText("Drinks")).toBeInTheDocument();
    expect(screen.getByText("Fresh milk")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Customize" }));
    expect(await screen.findByRole("button", { name: /Large/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Large/ }));
    expect(screen.getByText("Make it your own")).toBeInTheDocument();
    expect(screen.getByText("R$15.00")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Call the team" }));
    fireEvent.click(screen.getByRole("button", { name: "Language: English" }));
    const menu = screen.getByRole("menu");
    expect(menu).toHaveStyle({ right: "5.5rem" });
    expect(menu.parentElement).toHaveClass("z-50");
  });
});
