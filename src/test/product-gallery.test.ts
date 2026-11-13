import { describe, expect, it } from "vitest";
import type { GalleryItem } from "@/lib/format";
import {
  afterRemoveCover,
  appendMedia,
  galleryDraft,
  moveGalleryItem,
  promoteGalleryItem,
  removeGalleryItem,
} from "@/lib/product-gallery";

const capa = { url: "capa.jpg", type: "image" } as const;
const primeira = { url: "1.jpg", type: "image" } as const;
const segunda = { url: "2.jpg", type: "video" } as const;
const terceira = { url: "3.jpg", type: "image" } as const;

function urls(items: GalleryItem[]) {
  return items.map((item) => item.url);
}

describe("Fotos do prato", () => {
  it("vídeo/image preserve sua própria capa ao acrescentar fotos", () => {
    const video: GalleryItem = { url: "capa.mp4", type: "video" };
    const next = appendMedia(video, [primeira], [segunda, terceira]);
    expect(next.cover).toEqual(video);
    expect(urls(next.gallery)).toEqual(["1.jpg", "2.jpg", "3.jpg"]);
  });

  it("só escolhe a primeira foto automaticamente quando não tem capa", () => {
    expect(appendMedia(null, [], [primeira, segunda])).toEqual({
      cover: primeira,
      gallery: [segunda],
    });
  });

  it("promove a extra escolhida para capa e a retira da galeria", () => {
    const next = promoteGalleryItem(capa, [primeira, segunda, terceira], 1);
    expect(next.cover).toEqual(segunda);
    expect(urls(next.gallery)).toEqual(["1.jpg", "3.jpg"]);
  });

  it("reordena as extras sem escolher outra capa", () => {
    expect(urls(moveGalleryItem([primeira, segunda, terceira], 0, 1))).toEqual([
      "2.jpg",
      "1.jpg",
      "3.jpg",
    ]);
    expect(moveGalleryItem([primeira], 0, -1)).toEqual([primeira]);
  });

  it("remove pelo índice, inclusive a última foto restante", () => {
    expect(urls(removeGalleryItem([primeira, primeira, segunda], 0))).toEqual(["1.jpg", "2.jpg"]);
    expect(removeGalleryItem([primeira], 0)).toEqual([]);
  });

  it("usa a primeira extra ao remover a única capa pendente", () => {
    expect(afterRemoveCover([primeira, segunda])).toEqual({ cover: primeira, gallery: [segunda] });
  });

  it("preserva novas e antigas, respeitando reordenação pendente", () => {
    expect(galleryDraft([primeira], [segunda])).toEqual([primeira, segunda]);
    expect(galleryDraft([primeira, segunda], [segunda, primeira])).toEqual([segunda, primeira]);
    expect(galleryDraft([primeira], [])).toEqual([primeira]);
  });
});
