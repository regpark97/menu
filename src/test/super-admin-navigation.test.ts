import { describe, expect, it } from "vitest";
import { normalizeSuperAdminSection } from "@/components/dashboard/sections";
import { Route as SuperAdminRoute } from "@/routes/_authenticated/super-admin";

describe("Navegação do Super Admin", () => {
  it("mapeia section=tenants para a aba Clientes na rota", () => {
    const validate = SuperAdminRoute.options.validateSearch as (search: Record<string, unknown>) => {
      section?: "tenants";
    };
    expect(validate({ section: "tenants" }).section).toBe("tenants");
  });
  it.each(["leads", "tenants", "tags", "moderation"] as const)(
    "aceita a aba compartilhável %s",
    (section) => expect(normalizeSuperAdminSection(section)).toBe(section),
  );

  it.each([undefined, null, "", "cliente", "Tenant", " admin ", "leads,precos", {}])(
    "não aceita valor inválido no parâmetro section",
    (value) => expect(normalizeSuperAdminSection(value)).toBeUndefined(),
  );

  it("distingue a aba Clientes do destino solicitado por Trocar de cliente", () => {
    const link = { to: "/super-admin", search: { section: normalizeSuperAdminSection("tenants") } };
    expect(link.search.section).toBe("tenants");
  });
});
