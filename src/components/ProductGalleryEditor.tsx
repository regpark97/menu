import { useState } from "react";
import { ArrowLeft, ArrowRight, Images, Star, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { parseGallery, resolveMedia, type GalleryItem } from "@/lib/format";
import { uploadMedia } from "@/lib/media";
import {
  afterRemoveCover,
  appendMedia,
  galleryDraft,
  moveGalleryItem,
  promoteGalleryItem,
  removeGalleryItem,
} from "@/lib/product-gallery";

/** Editor unificado de mídia: toda alteração passa pela curadoria antes de publicar. */
export function ProductGalleryEditor({
  product,
  onChange,
}: {
  product: Tables<"products">;
  onChange: () => unknown;
}) {
  const [busy, setBusy] = useState(false);
  const [override, setOverride] = useState<GalleryItem[] | null>(null);
  const fallback = galleryDraft(
    parseGallery(product.media_gallery),
    parseGallery(product.pending_media_gallery),
  );
  const gallery = override ?? fallback;
  const cover: GalleryItem | null = product.pending_media_url
    ? {
        url: product.pending_media_url,
        type: product.pending_media_type === "video" ? "video" : "image",
      }
    : product.media_url
      ? { url: product.media_url, type: product.media_type === "video" ? "video" : "image" }
      : null;

  async function edit(next: { cover: GalleryItem | null; gallery: GalleryItem[] }) {
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("products")
        .update({
          pending_media_url: next.cover?.url ?? null,
          pending_media_type: next.cover?.type ?? null,
          pending_media_gallery: next.gallery,
          moderation_status: "pending",
        })
        .eq("id", product.id)
        .select("moderation_status")
        .single();
      if (error) throw error;
      if (data?.moderation_status !== "pending") {
        throw new Error("A alteração não entrou na fila de curadoria. Avise o suporte.");
      }
      // Inclusive uma galeria zerada deve aparecer vazia após remover a última foto.
      setOverride(next.gallery);
      await onChange();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      const uploaded: GalleryItem[] = [];
      for (const file of Array.from(files)) {
        uploaded.push(await uploadMedia(file, `${product.tenant_id}/${product.id}/gallery`));
      }
      await edit(appendMedia(cover, gallery, uploaded));
      toast.success("Fotos enviadas para aprovação. Aparecem no cardápio após a curadoria.", {
        duration: 6000,
      });
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-border p-3">
      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-1.5 text-sm font-medium">
          <Images className="h-4 w-4" /> Fotos do prato
        </label>
        <label
          className={`items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-secondary ${busy ? "pointer-events-none flex opacity-50" : "flex cursor-pointer"}`}
        >
          <Upload className="h-3.5 w-3.5" /> {busy ? "Enviando…" : "Adicionar fotos"}
          <input
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            disabled={busy}
            onChange={(event) => {
              const files = event.target.files;
              event.target.value = "";
              void upload(files);
            }}
          />
        </label>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {cover
          ? "Escolha a capa, reordene ou remova fotos. A publicação depende da aprovação."
          : "Ao enviar as fotos, a primeira vira capa automaticamente. Você pode trocar depois."}
      </p>
      {(cover || gallery.length > 0) && (
        <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(86px,1fr))] gap-3">
          {cover && (
            <figure>
              <MediaThumb item={cover} pending={!!product.pending_media_url} />
              <figcaption className="mt-1 flex items-center gap-1 text-xs font-medium text-gold">
                <Star className="h-3 w-3" /> Capa
              </figcaption>
              {product.pending_media_url && (
                <button
                  type="button"
                  disabled={busy}
                  className="mt-1 text-[11px] text-muted-foreground hover:text-foreground"
                  onClick={() =>
                    void edit(
                      product.media_url ? { cover: null, gallery } : afterRemoveCover(gallery),
                    )
                  }
                >
                  {product.media_url ? "Manter capa atual" : "Remover capa enviada"}
                </button>
              )}
            </figure>
          )}
          {gallery.map((item, index) => (
            <figure key={`${item.url}-${index}`}>
              <MediaThumb item={item} pending={product.moderation_status === "pending"} />
              <div className="mt-1 flex items-center gap-1">
                <button
                  type="button"
                  className="rounded p-0.5 hover:bg-secondary disabled:opacity-30"
                  disabled={busy || index === 0}
                  onClick={() => void edit({ cover, gallery: moveGalleryItem(gallery, index, -1) })}
                  aria-label={`Mover foto ${index + 2} para esquerda`}
                >
                  <ArrowLeft className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  className="rounded p-0.5 hover:bg-secondary disabled:opacity-30"
                  disabled={busy || index === gallery.length - 1}
                  onClick={() => void edit({ cover, gallery: moveGalleryItem(gallery, index, 1) })}
                  aria-label={`Mover foto ${index + 2} para direita`}
                >
                  <ArrowRight className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  className="ml-auto rounded p-0.5 text-muted-foreground hover:text-destructive"
                  disabled={busy}
                  onClick={() => void edit({ cover, gallery: removeGalleryItem(gallery, index) })}
                  aria-label={`Remover foto ${index + 2}`}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
              <button
                type="button"
                disabled={busy}
                className="mt-1 flex items-center gap-1 text-[11px] text-gold hover:underline"
                onClick={() => void edit(promoteGalleryItem(cover, gallery, index))}
              >
                <Star className="h-3 w-3" /> Usar como capa
              </button>
            </figure>
          ))}
        </div>
      )}
      {product.moderation_status === "pending" && (
        <p className="mt-3 text-xs text-warning">Mudanças nas fotos aguardando aprovação.</p>
      )}
    </div>
  );
}

function MediaThumb({ item, pending }: { item: GalleryItem; pending: boolean }) {
  return (
    <div
      className={`relative h-20 w-full overflow-hidden rounded-lg border-2 bg-secondary ${pending ? "border-warning" : "border-transparent"}`}
    >
      {item.type === "video" ? (
        <video src={resolveMedia(item.url)} muted className="h-full w-full object-cover" />
      ) : (
        <img src={resolveMedia(item.url)} alt="" className="h-full w-full object-cover" />
      )}
      {pending && (
        <span className="absolute bottom-1 right-1 rounded bg-black/65 px-1 text-[9px] text-white">
          Em análise
        </span>
      )}
    </div>
  );
}
