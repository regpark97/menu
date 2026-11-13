import { describe, expect, it } from "vitest";
import { filterTenantsByQuery } from "@/lib/tenant-picker";

const clients = [
  { id: "a", name: "Acre Café", slug: "acre-cafe" },
  { id: "b", name: "Café da Ana", slug: "cafe-da-ana" },
  { id: "c", name: "Boteco do Zé", slug: "boteco-ze" },
];

describe("Lista de clientes do Super Admin", () => {
  it("mostra todos os clientes quando a busca está vazia", () => {
    expect(filterTenantsByQuery(clients, "   ")).toEqual(clients);
  });

  it("encontra pelo nome sem distinguir maiúsculas ou acentos", () => {
    expect(filterTenantsByQuery(clients, "ana").map((t) => t.id)).toEqual(["b"]);
    expect(filterTenantsByQuery(clients, "CAFÉ").map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("encontra pelo slug", () => {
    expect(filterTenantsByQuery(clients, "boteco-ze").map((t) => t.id)).toEqual(["c"]);
  });

  it("não escolhe ninguém implicitamente quando a busca não tem resultado", () => {
    expect(filterTenantsByQuery(clients, "inexistente")).toEqual([]);
  });

  it("mostra lista completa, sem escolher o primeiro cliente quando há apenas um", () => {
    expect(filterTenantsByQuery([clients[0]!], "")).toHaveLength(1);
    expect(filterTenantsByQuery([clients[0]!], "").every((t) => t.id === "a")).toBe(true);
  });
});
