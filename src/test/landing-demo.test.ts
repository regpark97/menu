import { describe, expect, it } from "vitest";
import type { Tables } from "@/integrations/supabase/types";
import { landingFeed } from "@/lib/landing-demo";

describe("Exemplo do Peli's Noosa na LP", () => {
  it("escolhe um prato por categoria, dá prioridade a vídeos e preserva imagens", () => {
    const categories = [
      { id: "entradas", tenant_id: "peli", name: "Entradas", sort_order: 1 },
      { id: "bebidas", tenant_id: "peli", name: "Bebidas", sort_order: 2 },
    ] as Tables<"public_menu_children">[];
    const products = [
      {
        id: "foto",
        tenant_id: "peli",
        category_id: "entradas",
        name: "Foto",
        description: "desc",
        price_cents: 1000,
        media_url: "foto.jpg",
        media_type: "image",
        media_gallery: [],
        sort_order: 1,
      },
      {
        id: "video",
        tenant_id: "peli",
        category_id: "entradas",
        name: "Vídeo",
        description: null,
        price_cents: 2000,
        media_url: "video.mp4",
        media_type: "video",
        media_gallery: [],
        sort_order: 2,
      },
      {
        id: "suco",
        tenant_id: "peli",
        category_id: "bebidas",
        name: "Suco",
        description: null,
        price_cents: 900,
        media_url: "suco.jpg",
        media_type: "image",
        media_gallery: [],
        sort_order: 1,
      },
    ].map((product) => ({
      ...product,
      modifiers: [],
      is_available: true,
      is_featured: false,
    })) satisfies Tables<"public_menu_products">[];

    expect(landingFeed(categories, products)).toEqual([
      {
        cat: "entradas",
        label: "Peli's Noosa · Entradas",
        name: "Vídeo",
        desc: "",
        price: "R$" + String.fromCharCode(160) + "20,00",
        video: "video.mp4",
      },
      {
        cat: "bebidas",
        label: "Peli's Noosa · Bebidas",
        name: "Suco",
        desc: "",
        price: "R$" + String.fromCharCode(160) + "9,00",
        image: "suco.jpg",
      },
    ]);
  });
});
