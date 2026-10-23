import { supabase } from "@/integrations/supabase/client";

/** Uploads to the private media bucket and returns a long-lived signed URL. */
export async function uploadMedia(file: File, folder: string) {
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
