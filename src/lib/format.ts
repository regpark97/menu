/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  FORMAT — utilitários purinhos de formato e parsing do BUPIN
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  Regras de ouro deste arquivo:
 *   - Nada de estado, nada de efeitos: funções puras, fáceis de testar.
 *   - Todo parse é defensivo: jsonb do banco chega como `unknown` e nunca
 *     pode derrubar o cardápio do cliente por causa de um campo torto.
 */

/** 1990 → "R$ 19,90" (centavos no banco, moeda formatada na tela). */
export function formatMoney(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Máscara de moeda de um dígito: mantém só números e devolve centavos.
 * "R$ 19,90" → 1990. Slice de 9 dígitos trava em ~R$ 9.999.999,99 —
 * suficiente e evita overflow de int em inputs maliciosos.
 */
export function parseMoneyInput(raw: string): number {
  const digits = raw.replace(/\D/g, "").slice(0, 9);
  return digits ? parseInt(digits, 10) : 0;
}

/** Limite rígido de descrição: o layout mobile do feed quebra acima disso. */
export const DESCRIPTION_LIMIT = 180;

/**
 * Janela de atenção válida: 400ms ≤ tempo ≤ 120s.
 * Abaixo disso é scroll acidental; acima, celular esquecido aberto na mesa.
 * Os dois sujariam a métrica de "tempo médio de atenção" do painel.
 */
export function isValidAttention(ms: number) {
  return ms >= 400 && ms <= 120_000;
}

/** Fallback visual quando um prato ainda não tem mídia. */
export function resolveMedia(url: string | null | undefined) {
  return url || "/images/hero.jpg";
}

/** Estrutura de adicionais persistida no jsonb `products.modifiers`. */
export type ModifierGroup = { group: string; options: { name: string; price_cents: number }[] };

/** Normaliza o jsonb modifiers (unknown) para uma lista tipada e segura. */
export function parseModifiers(raw: unknown): ModifierGroup[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map((x) => {
      const opts = Array.isArray(x["options"]) ? x["options"] : [];
      return {
        group: typeof x["group"] === "string" ? x["group"] : "",
        options: opts
          .filter((o): o is Record<string, unknown> => !!o && typeof o === "object")
          .map((o) => ({
            name: typeof o["name"] === "string" ? o["name"] : "",
            price_cents: typeof o["price_cents"] === "number" ? o["price_cents"] : 0,
          }))
          .filter((o) => o.name.length > 0),
      };
    })
    .filter((g) => g.group.length > 0 && g.options.length > 0);
}

/** Remove grupos/opções vazios antes de persistir (evita lixo no jsonb). */
export function cleanModifiers(groups: ModifierGroup[]): ModifierGroup[] {
  return groups
    .map((g) => ({
      group: g.group.trim(),
      options: g.options
        .map((o) => ({ name: o.name.trim(), price_cents: o.price_cents }))
        .filter((o) => o.name.length > 0),
    }))
    .filter((g) => g.group.length > 0 && g.options.length > 0);
}

/** Item de galeria persistido no jsonb `products.media_gallery`. */
export type GalleryItem = { url: string; type: "image" | "video" };

/** Normaliza o jsonb media_gallery (unknown) para uma lista tipada e segura. */
export function parseGallery(raw: unknown): GalleryItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map((x) => ({
      url: typeof x["url"] === "string" ? x["url"] : "",
      type: x["type"] === "video" ? ("video" as const) : ("image" as const),
    }))
    .filter((x) => x.url.length > 0);
}

/**
 * Fotos que o cliente vê no feed: capa (media_url) + galeria, sem duplicatas.
 * A capa vem primeiro porque é a que a moderação garantiu em foco.
 */
export function productPhotos(
  mediaUrl: string | null,
  mediaType: string,
  gallery: GalleryItem[],
): GalleryItem[] {
  const list: GalleryItem[] = [];
  if (mediaUrl) list.push({ url: mediaUrl, type: mediaType === "video" ? "video" : "image" });
  for (const g of gallery) {
    if (!list.some((x) => x.url === g.url)) list.push(g);
  }
  return list;
}
