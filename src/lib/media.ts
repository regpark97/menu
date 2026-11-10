/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  UPLOAD DE MÍDIA — guarda-fogo do storage do BUPIN
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  Toda foto/vídeo de prato, logo e fundo de tela passa por aqui. O motivo
 *  das validações: o dono do restaurante edita pelo CELULAR, e vídeos de
 *  celular gravados em 4K passam facilmente de 100 MB. Sem esta trava, um
 *  upload desses iria direto pro bucket (limite Supabase: 50 MB por
 *  arquivo) e comeria storage pago à toa — além de falhar com erro
 *  críptico de API no meio do upload.
 *
 *  Fluxo: validar → subir → assinar URL de 10 anos → devolver {url, type}.
 *  A URL assinada é persistida no banco (products.media_url etc.), por isso
 *  o prazo longo; rotacionar o bucket exige regerar as URLs salvas.
 */

import { supabase } from "@/integrations/supabase/client";

/** Limites validados no cliente ANTES de gastar banda e storage. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB — foto de celular
export const MAX_VIDEO_BYTES = 25 * 1024 * 1024; // 25 MB — ~15s de vídeo já é o ideal

/** 12345678 → "12 MB" (para mensagens de erro humanas). */
function human(bytes: number) {
  return (bytes / (1024 * 1024)).toFixed(0) + " MB";
}

/**
 * Valida tamanho e tipo antes do upload. Lança Error com mensagem amigável
 * (o chamador mostra via toast) — o erro de API do Supabase é sempre
 * críptico demais para um dono de café entender.
 */
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

/**
 * Sobe um arquivo para o bucket privado `media` e devolve a URL assinada.
 *
 * @param folder Subpasta dentro do bucket. Convenção em uso:
 *   `{tenantId}/{productId}` para capa, `{tenantId}/logo|bg`, e
 *   `{tenantId}/{productId}/gallery` para fotos extras — a hierarquia
 *   permite limpar tudo de um cliente/permite achar mídia órfã.
 */
export async function uploadMedia(file: File, folder: string) {
  assertValidMedia(file);
  const ext = file.name.split(".").pop() || "bin";
  // Timestamp no nome evita colisões e cache fantasma em reuploads.
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
