import type { Tables } from "@/integrations/supabase/types";
import { formatMoney, parseGallery, productPhotos, resolveMedia } from "@/lib/format";

export type LpDemoCard = {
  cat: string;
  label: string;
  name: string;
  desc: string;
  price: string;
} & ({ video: string; image?: never } | { image: string; video?: never });

type Category = Tables<"public_menu_children">;
type Product = Tables<"public_menu_products">;

/** Um prato por categoria, preferindo vídeo — o formato que demonstra melhor o BUPIN. */
export function landingFeed(categories: Category[], products: Product[]): LpDemoCard[] {
  return [...categories]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((category) => {
      const candidates = products
        .filter((product) => product.category_id === category.id)
        .sort((a, b) => a.sort_order - b.sort_order);
      const product = candidates.find((p) => p.media_type === "video") ?? candidates[0];
      if (!product) return undefined;
      const media = productPhotos(
        product.media_url,
        product.media_type,
        parseGallery(product.media_gallery),
      )[0];
      return {
        cat: category.id,
        label: `Peli's Noosa · ${category.name}`,
        name: product.name,
        desc: product.description ?? "",
        price: formatMoney(product.price_cents),
        ...(media?.type === "video"
          ? { video: resolveMedia(media.url) }
          : { image: resolveMedia(media?.url) }),
      };
    })
    .filter((card): card is LpDemoCard => !!card);
}
