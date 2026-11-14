import { beforeEach, describe, expect, it } from "vitest";
import {
  isMenuGateUnlocked,
  markMenuGateUnlocked,
  menuGateStorageKey,
  needsMenuGate,
  validateGateContact,
} from "@/lib/menu-gate";

describe("Desbloqueio opcional do cardápio", () => {
  beforeEach(() => localStorage.clear());

  it("exige ativação explícita do dono", () => {
    expect(needsMenuGate(undefined, "t1")).toBe(false);
    expect(needsMenuGate(false, "t1")).toBe(false);
    expect(needsMenuGate(true, "t1")).toBe(true);
  });

  it("lembra o desbloqueio apenas no dispositivo do restaurante correto", () => {
    expect(isMenuGateUnlocked("t1")).toBe(false);
    markMenuGateUnlocked("t1");
    expect(isMenuGateUnlocked("t1")).toBe(true);
    expect(isMenuGateUnlocked("t2")).toBe(false);
    expect(localStorage.getItem(menuGateStorageKey("t1"))).toBe("1");
    expect(needsMenuGate(true, "t1")).toBe(false);
  });

  it("normaliza nome e WhatsApp e rejeita entradas insuficientes", () => {
    expect(validateGateContact("  Maria   Souza  ", "+55 (11) 98765-4321")).toEqual({
      fullName: "Maria Souza",
      whatsapp: "5511987654321",
      nameValid: true,
      phoneValid: true,
    });
    expect(validateGateContact("Maria", "999").nameValid).toBe(false);
    expect(validateGateContact("Maria Souza", "999").phoneValid).toBe(false);
    expect(validateGateContact("Maria Souza", "1".repeat(16)).phoneValid).toBe(false);
  });
});
