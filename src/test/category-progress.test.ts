import { describe, expect, it } from "vitest";
import { categoryProgress } from "@/lib/category-progress";

describe("Indicador discreto das categorias", () => {
  it("fica oculto quando todas cabem na largura disponível", () => {
    expect(categoryProgress(300, 280, 0)).toEqual({ visible: false, left: 0, width: 100 });
  });

  it("mostra um terço quando um terço das categorias está visível", () => {
    expect(categoryProgress(100, 300, 0)).toEqual({
      visible: true,
      width: expect.closeTo(100 / 3),
      left: 0,
    });
  });

  it("move o traço junto com o arrasto e nunca passa do final", () => {
    expect(categoryProgress(100, 200, 50)).toEqual({ visible: true, width: 50, left: 25 });
    expect(categoryProgress(100, 200, 150)).toEqual({ visible: true, width: 50, left: 50 });
  });
});
