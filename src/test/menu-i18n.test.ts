import { afterEach, describe, expect, it, vi } from "vitest";
import {
  LANGUAGE_OPTIONS,
  MENU_LOCALES,
  UI_MESSAGES,
  UI_WAITER_MESSAGES,
  moneyText,
  uiText,
} from "@/lib/menu-i18n";
import { cachedTranslation, collectMenuTexts, translationWorker } from "@/lib/menu-translator";

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  localStorage.clear();
});

const messages = { ...UI_MESSAGES, ...UI_WAITER_MESSAGES } as const;

describe("Idiomas disponíveis", () => {
  it("tem todas as traduções fixas para os sete países, incluindo mandarim", () => {
    expect(MENU_LOCALES).toEqual(["pt-BR", "en", "fr", "it", "es", "ru", "zh-CN"]);
    expect(LANGUAGE_OPTIONS).toHaveLength(7);
    for (const rows of Object.values(messages)) {
      expect(rows).toHaveLength(MENU_LOCALES.length);
      expect(rows.every((text) => typeof text === "string" && text.length > 0)).toBe(true);
    }
    expect(uiText("en", "customize")).toBe("Customize");
    expect(uiText("zh-CN", "copyPassword")).toBe("复制密码");
  });

  it("preserva a moeda em reais e adapta só o formato", () => {
    expect(moneyText(2990, "pt-BR")).toContain("29,90");
    expect(moneyText(2990, "en")).toContain("29.90");
  });
});

describe("Tradução de cardápio", () => {
  it("deduplica nomes, descrições, categorias e opções", () => {
    const texts = collectMenuTexts(
      [{ name: "Bebidas" }],
      [
        {
          name: "Café",
          description: "Leite fresco",
          modifiers: [{ group: "Leite", options: [{ name: "Aveia" }] }],
        },
      ],
    );
    expect(texts).toEqual(["Bebidas", "Café", "Leite fresco", "Leite", "Aveia"]);
  });

  it("usa a API, persiste e reutiliza o resultado sem repetir pedidos", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ responseData: { translatedText: "Break fast" }, responseStatus: 200 }),
    } as Response);
    const apply = vi.fn();
    await translationWorker(["Café de teste"], "en", apply);
    await translationWorker(["Café de teste"], "en", apply);
    expect(apply).toHaveBeenLastCalledWith("Café de teste", "Break fast");
    expect(fetch).toHaveBeenCalledOnce();
    expect(vi.mocked(fetch).mock.calls[0]![0]).toContain("langpair=pt%7Cen");
    expect(cachedTranslation("en", "Café de teste")).toBe("Break fast");
  });

  it("conserva o original quando a API não responde e quando estoura a cota", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new TypeError("Sem rede"))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ quotaFinished: true }) } as Response);
    const apply = vi.fn();
    await translationWorker(["Prato sem rede"], "ru", apply);
    await translationWorker(["Prato sem rede"], "en", apply);
    expect(apply).toHaveBeenNthCalledWith(1, "Prato sem rede", "Prato sem rede");
    expect(apply).toHaveBeenNthCalledWith(2, "Prato sem rede", "Prato sem rede");
  });

  it("não chama a API para português", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    await translationWorker(["Prato local"], "pt-BR", () => {});
    expect(spy).not.toHaveBeenCalled();
  });
});
