import { supabase } from "@/integrations/supabase/client";

/** Limites do bucket (validados no cliente antes do upload). */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_VIDEO_BYTES = 25 * 1024 * 1024; // 25 MB (limite Supabase: 50 MB)

function human(bytes: number) {
  return (bytes / (1024 * 1024)).toFixed(0) + " MB";
}

/** Valida tamanho/tipo antes de gastar banda e storage. */
export function assertValidMedia(file: File) {
  if (file.type.startsWith("video/")) {
    if (file.size > MAX_VIDEO_BYTES)
      throw new Error(
        `Vídeo muito grande (${human(file.size)}). Envie até ${human(MAX_VIDEO_BYTES)} — uma duração de ~15s já é o ideal.`,
      );
  } else {
    if (file.size > MAX_IMAGE_BYTES)
      throw new Error(`Imagem muito grande (${human(file.size)}). Envie até ${human(MAX_IMAGE_BYTES)}.`);
  }
  if (!/^image\/|^video\//.test(file.type))
    throw new Error("Envie uma imagem ou vídeo.");
}

/** Uploads to the private media bucket and returns a long-lived signed URL. */
export async function uploadMedia(file: File, folder: string) {
  assertValidMedia(file);
  const ext = file.name.split(".").pop() || "bin";
  const path = `${folder}/${Date.now()}.${ext}`;
  const up = await supabase.storage.from("media").upload(path, file, { contentType: file.type });
  if (up.error) throw up.error;
  const signed = await supabase.storage.from("media").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
  if (signed.error) throw signed.error;
  return {
    url: signed.data.signedUrl,
    type: file.type.startsWith("video") ? ("video" as const) : ("image" as const),
  };
}
