import { describe, expect, it } from "vitest";
import { leadsToCsv } from "@/lib/leads-csv";

describe("Exportação dos contatos captados", () => {
  it("exporta nome, WhatsApp e data com BOM UTF-8 e quebras CRLF", () => {
    const csv = leadsToCsv([
      { full_name: 'Maria "Souza"', whatsapp: "11988887777", created_at: "2026-11-13T12:00:00Z" },
    ]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('"Nome","WhatsApp","Criado em"\r\n');
    expect(csv).toContain('"Maria ""Souza""","11988887777","2026-11-13T12:00:00Z"');
  });

  it("neutraliza texto malicioso antes de abrir em planilhas", () => {
    const csv = leadsToCsv([
      { full_name: "=SUM(A1:A2)", whatsapp: "11988887777", created_at: "agora" },
    ]);
    expect(csv).toContain('"\'=SUM(A1:A2)"');
  });
});
