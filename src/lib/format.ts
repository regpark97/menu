export function formatMoney(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Currency mask: keeps digits only and returns cents. */
export function parseMoneyInput(raw: string): number {
  const digits = raw.replace(/\D/g, "").slice(0, 9);
  return digits ? parseInt(digits, 10) : 0;
}

export const DESCRIPTION_LIMIT = 180;

/** Attention window filter: drops accidental scrolls and forgotten phones. */
export function isValidAttention(ms: number) {
  return ms >= 400 && ms <= 120_000;
}

export function resolveMedia(url: string | null | undefined) {
  return url || "/images/hero.jpg";
}

export type ModifierGroup = { group: string; options: { name: string; price_cents: number }[] };

/** Normaliza o jsonb modifiers para uma lista tipada e segura. */
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

export type GalleryItem = { url: string; type: "image" | "video" };

/** Normaliza o jsonb media_gallery (desconhecido) para uma lista tipada e segura. */
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

/** Fotos para exibir no feed do cliente: capa (media_url) + galeria, sem duplicatas. */
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
