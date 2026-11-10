/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  ROTA CORINGA DAS TAGS NFC — /t/:tag
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  É a porta de entrada física do sistema: o cartão NFC gravado na mesa
 *  aponta para /t/tag-001. Esta rota consulta a tabela nfc_tags e decide:
 *
 *    ┌─ tag inativa ou inexistente ──→ mensagem "chame um atendente"
 *    ├─ custom_redirect_url preenchido ──→ vai para URL externa (a tag vira
 *    │   um QR/NFC genérico reutilizável, ex.: promoção, menu de evento)
 *    └─ tag vinculada a um tenant ──→ /c/{slug}?t={mesa}
 *
 *  O motivo de existir: os cartões físicos NUNCA precisam ser regravados.
 *  Mudou o cliente dono da tag, a mesa ou o destino? Tudo se resolve no
 *  painel (super admin), o cartão continua apontando para /t/tag-001.
 *
 *  noindex: é ponte, não página — não deve aparecer no Google.
 */

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/t/$tag")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Abrindo cardápio… — Bupin" },
      { name: "description", content: "Redirecionando para o cardápio da sua mesa." },
      { property: "og:title", content: "Cardápio da mesa — Bupin" },
      { property: "og:description", content: "Toque no cartão NFC e descubra o cardápio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TagRedirect,
});

function TagRedirect() {
  const { tag } = Route.useParams();
  const navigate = useNavigate();
  const [error, setError] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("nfc_tags")
        .select("custom_redirect_url, table_label, active, tenants(slug)")
        .eq("tag_code", tag)
        .maybeSingle();
      if (!data || !data.active) return setError(true);
      if (data.custom_redirect_url) {
        window.location.replace(data.custom_redirect_url);
        return;
      }
      const slug = (data.tenants as { slug: string } | null)?.slug;
      if (!slug) return setError(true);
      navigate({
        to: "/c/$slug",
        params: { slug },
        search: { t: data.table_label ?? undefined },
        replace: true,
      });
    })();
  }, [tag, navigate]);

  return (
    <main className="flex min-h-dvh items-center justify-center px-6 text-center">
      {error ? (
        <p className="text-muted-foreground">
          Este cartão ainda não está ativo. Chame um atendente.
        </p>
      ) : (
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" />
      )}
    </main>
  );
}
