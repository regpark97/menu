import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MenuLanguageProvider } from "@/hooks/use-menu-language";
import { LanguageSelector } from "@/components/LanguageSelector";

describe("Seletor de idiomas", () => {
  it("oferece os sete idiomas, abre à esquerda do garçom e fecha após escolha", () => {
    const change = vi.fn();
    render(
      <MenuLanguageProvider>
        <LanguageSelector locale="pt-BR" onChange={change} />
      </MenuLanguageProvider>,
    );
    const trigger = screen.getByRole("button", { name: /Idioma/ });
    fireEvent.click(trigger);
    const menu = screen.getByRole("menu");
    expect(screen.getAllByRole("menuitemradio")).toHaveLength(7);
    expect(menu).toHaveStyle({ position: "fixed", right: "5.5rem" });
    expect(menu.parentElement).toHaveClass("z-50");
    fireEvent.click(screen.getByRole("menuitemradio", { name: "English" }));
    expect(change).toHaveBeenCalledWith("en");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("fecha com Escape e devolve o foco", () => {
    render(
      <MenuLanguageProvider>
        <LanguageSelector locale="pt-BR" onChange={() => {}} />
      </MenuLanguageProvider>,
    );
    const trigger = screen.getByRole("button", { name: /Idioma/ });
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
