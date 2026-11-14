import type { Tables } from "@/integrations/supabase/types";
import { resolveMedia } from "@/lib/format";

/** Fundo e escurecimento idênticos à home, reutilizados pela tela de captura. */
export function RestaurantBackdrop({ tenant }: { tenant: Tables<"public_menu"> }) {
  const bg = resolveMedia(tenant.bg_image_url);
  const isVideo = /\.(mp4|webm|mov)(\?|$)/i.test(bg);
  return (
    <div className="absolute inset-0">
      {isVideo ? (
        <video
          src={bg}
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <img src={bg} alt="" className="absolute inset-0 h-full w-full object-cover" />
      )}
      <div className="absolute inset-0 bg-hero-scrim" />
    </div>
  );
}
