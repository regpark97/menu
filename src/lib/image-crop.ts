import type { Area } from "react-easy-crop";

export const CARD_MEDIA_MAX_WIDTH = 1080;
export const CARD_MEDIA_MAX_HEIGHT = 1920;

/** Recorte em pixels naturais, limitado às bordas da imagem e sem ampliar ruído. */
export function cropDimensions(pixels: Area, naturalWidth: number, naturalHeight: number) {
  const x = Math.max(0, Math.min(naturalWidth - 1, Math.round(pixels.x)));
  const y = Math.max(0, Math.min(naturalHeight - 1, Math.round(pixels.y)));
  const width = Math.max(1, Math.min(naturalWidth - x, Math.round(pixels.width)));
  const height = Math.max(1, Math.min(naturalHeight - y, Math.round(pixels.height)));
  const scale = Math.min(1, CARD_MEDIA_MAX_WIDTH / width, CARD_MEDIA_MAX_HEIGHT / height);
  return {
    x,
    y,
    width,
    height,
    outWidth: Math.max(1, Math.round(width * scale)),
    outHeight: Math.max(1, Math.round(height * scale)),
  };
}

/** Gera JPEG com o enquadramento escolhido pelo usuário, localmente. */
export async function cropImage(file: File, pixels: Area, suffix = "-9x16.jpg"): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    const loaded = new Promise<HTMLImageElement>((resolve, reject) => {
      image.onload = () => resolve(image);
      image.onerror = () =>
        reject(new Error("Não consegui abrir esta imagem. Tente um arquivo JPEG ou PNG."));
    });
    image.src = url;
    const img = await loaded;
    const crop = cropDimensions(pixels, img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = crop.outWidth;
    canvas.height = crop.outHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Seu navegador não permite preparar a foto.");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(
      img,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      crop.outWidth,
      crop.outHeight,
    );
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (result) =>
          result ? resolve(result) : reject(new Error("Não foi possível gerar a foto cortada.")),
        "image/jpeg",
        0.9,
      ),
    );
    const baseName = file.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${baseName}${suffix}`, { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Compatibilidade com o fluxo dos pratos: recorte vertical do feed. */
export function cropImageForCard(file: File, pixels: Area): Promise<File> {
  return cropImage(file, pixels);
}
