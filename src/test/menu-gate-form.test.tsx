import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MenuLanguageProvider } from "@/hooks/use-menu-language";
import { MenuGate } from "@/components/MenuGate";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { menuGateStorageKey } from "@/lib/menu-gate";

const insertLead = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn(() => ({ insert: insertLead })) },
}));

const tenant = {
  id: "t1",
  slug: "cantina",
  name: "Cantina Verde",
  tagline: null,
  logo_url: null,
  bg_image_url: null,
  wifi_ssid: null,
  google_review_url: null,
  menu_gate_enabled: true,
} as Tables<"public_menu">;

function renderGate(onUnlock = vi.fn(), onBack = vi.fn()) {
  render(
    <MenuLanguageProvider>
      <MenuGate tenant={tenant} onUnlock={onUnlock} onBack={onBack} />
    </MenuLanguageProvider>,
  );
  return { onUnlock, onBack };
}

describe("Desbloqueio com nome e WhatsApp", () => {
  beforeEach(() => {
    localStorage.clear();
    insertLead.mockReset().mockResolvedValue({ error: null });
  });

  it("exige nome completo e um WhatsApp válido antes de consultar o banco", () => {
    renderGate();
    fireEvent.click(screen.getByRole("button", { name: "Desbloquear cardápio" }));
    expect(screen.getByText("Informe seu nome e sobrenome.")).toBeInTheDocument();
    expect(screen.getByText("Informe o WhatsApp com DDD.")).toBeInTheDocument();
    expect(supabase.from).not.toHaveBeenCalledWith("menu_gate_leads");
  });

  it("normaliza os dados, salva o contato e libera o feed", async () => {
    const { onUnlock } = renderGate();
    fireEvent.change(screen.getByLabelText("Nome completo"), {
      target: { value: "  Maria   Souza " },
    });
    fireEvent.change(screen.getByLabelText("WhatsApp"), { target: { value: "(11) 98888-7777" } });
    fireEvent.click(screen.getByRole("button", { name: "Desbloquear cardápio" }));

    await waitFor(() => expect(onUnlock).toHaveBeenCalledOnce());
    expect(vi.mocked(supabase.from("menu_gate_leads").insert)).toHaveBeenCalledWith({
      tenant_id: "t1",
      full_name: "Maria Souza",
      whatsapp: "11988887777",
    });
    expect(localStorage.getItem(menuGateStorageKey("t1"))).toBe("1");
  });

  it("mantém o acesso bloqueado e informa o erro se a gravação falhar", async () => {
    insertLead.mockResolvedValueOnce({ error: { message: "sem permissão" } });
    const { onUnlock } = renderGate();
    fireEvent.change(screen.getByLabelText("Nome completo"), { target: { value: "Maria Souza" } });
    fireEvent.change(screen.getByLabelText("WhatsApp"), { target: { value: "(11) 98888-7777" } });
    fireEvent.click(screen.getByRole("button", { name: "Desbloquear cardápio" }));

    expect(
      await screen.findByText("Não foi possível salvar agora. Tente novamente."),
    ).toBeInTheDocument();
    expect(onUnlock).not.toHaveBeenCalled();
    expect(localStorage.getItem(menuGateStorageKey("t1"))).toBeNull();
  });
});
