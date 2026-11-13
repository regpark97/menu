import type { GalleryItem } from "./format";

/** Compatível com filas antigas, que continham só os uploads novos, e com editor,
 *  cuja fila sempre representa a galeria completa proposta. */
export function galleryDraft(gallery: GalleryItem[], pending: GalleryItem[]) {
  if (!pending.length) return gallery;
  const publishedUrls = new Set(gallery.map((item) => item.url));
  // Se só houve reordenação/remoção, a própria proposta já é a lista completa.
  if (pending.every((item) => publishedUrls.has(item.url))) return pending;
  // Compatibilidade: aprovadas antigas + recém-enviadas pendentes, sem duplicatas.
  return [...gallery, ...pending].filter(
    (item, index, all) => all.findIndex((other) => other.url === item.url) === index,
  );
}

/** A primeira foto vira capa apenas quando ainda não existe uma principal. */
export function appendMedia(
  cover: GalleryItem | null,
  gallery: GalleryItem[],
  uploaded: GalleryItem[],
) {
  if (cover || uploaded.length === 0) return { cover, gallery: [...gallery, ...uploaded] };
  return { cover: uploaded[0]!, gallery: [...gallery, ...uploaded.slice(1)] };
}

/** Promove um item da galeria; a imagem antiga permanece na pasta, mas sai da capa. */
export function promoteGalleryItem(
  cover: GalleryItem | null,
  gallery: GalleryItem[],
  index: number,
) {
  if (!gallery[index]) return { cover, gallery };
  return { cover: gallery[index]!, gallery: gallery.filter((_, i) => i !== index) };
}

export function moveGalleryItem(gallery: GalleryItem[], index: number, dir: -1 | 1) {
  const nextIndex = index + dir;
  if (nextIndex < 0 || nextIndex >= gallery.length) return gallery;
  const next = [...gallery];
  [next[index], next[nextIndex]] = [next[nextIndex]!, next[index]!];
  return next;
}

export function removeGalleryItem(gallery: GalleryItem[], index: number) {
  return gallery.filter((_, i) => i !== index);
}

/** Após descartar a capa pendente sem capa aprovada, usa a primeira extra — e só. */
export function afterRemoveCover(gallery: GalleryItem[]) {
  return { cover: gallery[0] ?? null, gallery: gallery[0] ? gallery.slice(1) : gallery };
}
