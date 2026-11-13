import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MenuLanguageProvider, MenuContentProvider, useMenuLanguage, useMenuText } from "@/hooks/use-menu-language";
import { LanguageSelector } from "@/components/LanguageSelector";

function Harness() {
  const { locale, setLocale } = useMenuLanguage();
  const { text } = useMenuText();
  return (
    <>
      <LanguageSelector locale={locale} onChange={setLocale} />
      <h2>{text("Café da casa")}</h2>
      <span>{text("Grande")}</span>
    </>
  );
}

describe("Atualização de tradução no cardápio", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => ({
      ok: true,
      json: async () => ({ responseData: { translatedText: "Breakfast coffee" }, responseStatus: 200 }),
    } as Response));
  });

  it("atualiza o texto quando o idioma e a tradução chegam", async () => {
    render(
      <MenuLanguageProvider>
        <MenuContentProvider categories={[]} products={[{ name: "Café da casa", description: null, modifiers: [] }]}>
          <Harness />
        </MenuContentProvider>
      </MenuLanguageProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Idioma/ }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "English" }));
    expect(await screen.findByText("Breakfast coffee")).toBeInTheDocument();
  });
});
