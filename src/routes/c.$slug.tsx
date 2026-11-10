/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  CARDÁPIO DO CLIENTE — /c/:slug?mesa=04
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  A experiência que o BUPIN vende. Duas telas no mesmo componente:
 *
 *   1. HUB (boas-vindas)   → fundo do estabelecimento, logo, e 3 botões:
 *                            cardápio (branco), Google Reviews e Wi-Fi (vidro).
 *   2. FEED (descoberta)   → pratos em tela cheia, scroll vertical com snap,
 *                            swipe horizontal navega a galeria de cada prato.
 *
 *  Detalhes que sustentam o produto:
 *   - Telemetria invisível: initTelemetry liga o motor ao carregar; o
 *     IntersectionObserver de cada ProductCard cronometra a atenção real
 *     (veja comentário no motor, dentro de ProductCard).
 *   - ssr:false — o cardápio é 100% cliente (telemetria + sessão por aba);
 *     pré-renderizar uma página cheia de eventos anônimos não faz sentido.
 *   - Pratos indisponíveis (is_available=false) nem chegam ao feed: o
 *     filtro acontece na query, não no render.
 *   - Botão flutuante de garçom/conta/gerente (WaiterButton) com cooldown
 *     anti-spam de 2 min — verificado também no banco (RPC call_waiter).
 */

import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  ChevronRight,
  Heart,
  Wifi,
  Copy,
  Check,
  X,
  Plus,
  ChevronLeft,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { WaiterButton } from "@/components/WaiterButton";
import {
  formatMoney,
  resolveMedia,
  parseGallery,
  productPhotos,
  type ModifierGroup,
} from "@/lib/format";
import { initTelemetry, track } from "@/lib/telemetry";
import type { Tables } from "@/integrations/supabase/types";

type Product = Tables<"products">;

export const Route = createFileRoute("/c/$slug")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): { t?: string | undefined } => ({
    t: s["t"] != null ? String(s["t"]) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Cardápio — Bupin" },
      {
        name: "description",
        content: "Descubra o cardápio em tela cheia, conecte-se ao Wi-Fi e avalie a casa.",
      },
      { property: "og:title", content: "Cardápio interativo — Bupin" },
      { property: "og:description", content: "Explore pratos e bebidas em um feed vertical." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CustomerPage,
});

function CustomerPage() {
  const { slug } = Route.useParams();
  const { t } = Route.useSearch();
  const [screen, setScreen] = useState<"hub" | "feed">("hub");

  const { data, isLoading } = useQuery({
    queryKey: ["menu", slug],
    queryFn: async () => {
      const { data: tenant } = await supabase
        .from("tenants")
        .select("*")
        .eq("slug", slug)
        .eq("active", true)
        .maybeSingle();
      if (!tenant) return null;
      const [cats, prods] = await Promise.all([
        supabase.from("categories").select("*").eq("tenant_id", tenant.id).order("sort_order"),
        supabase
          .from("products")
          .select("*")
          .eq("tenant_id", tenant.id)
          .eq("is_available", true)
          .order("sort_order"),
      ]);
      return { tenant, categories: cats.data ?? [], products: prods.data ?? [] };
    },
  });

  useEffect(() => {
    if (data?.tenant) initTelemetry({ tenantId: data.tenant.id, tableRef: t ?? null });
  }, [data?.tenant, t]);

  if (isLoading)
    return (
      <div className="flex h-dvh items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" />
      </div>
    );
  if (!data)
    return (
      <div className="flex h-dvh items-center justify-center px-6 text-center text-muted-foreground">
        Estabelecimento não encontrado.
      </div>
    );

  return (
    <>
      {screen === "hub" ? (
        <Hub tenant={data.tenant} table={t} onExplore={() => setScreen("feed")} />
      ) : (
        <Feed
          categories={data.categories}
          products={data.products}
          onBack={() => setScreen("hub")}
        />
      )}
      <WaiterButton tenantId={data.tenant.id} table={t ?? undefined} />
    </>
  );
}

function Hub({
  tenant,
  table,
  onExplore,
}: {
  tenant: Tables<"tenants">;
  table?: string | undefined;
  onExplore: () => void;
}) {
  const [wifiOpen, setWifiOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const bg = resolveMedia(tenant.bg_image_url);
  const isVideo = /\.(mp4|webm|mov)(\?|$)/i.test(bg);

  return (
    <main className="relative h-dvh overflow-hidden">
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
      <div className="relative flex h-full flex-col px-6 pb-10 pt-6">
        {table && (
          <div className="mx-auto glass rounded-full px-4 py-1.5 text-xs uppercase tracking-[0.25em]">
            Mesa {table}
          </div>
        )}
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          {tenant.logo_url && (
            <img src={tenant.logo_url} alt={tenant.name} className="h-24 w-24 object-contain" />
          )}
          <h1 className="mt-4 text-5xl leading-none">{tenant.name}</h1>
          {tenant.tagline && (
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">{tenant.tagline}</p>
          )}
        </div>
        <div className="space-y-3">
          <button
            onClick={onExplore}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary font-semibold text-primary-foreground active:scale-[0.98]"
          >
            Explorar Cardápio <ArrowRight className="h-5 w-5" />
          </button>
          {tenant.google_review_url && (
            <a
              href={tenant.google_review_url}
              target="_blank"
              rel="noreferrer"
              onClick={() => track("review_click")}
              className="glass flex h-14 w-full items-center justify-center gap-2 rounded-2xl font-medium active:scale-[0.98]"
            >
              Avaliar no Google <ArrowUpRight className="h-5 w-5" />
            </a>
          )}
          {tenant.wifi_ssid && (
            <button
              onClick={() => {
                track("wifi_open");
                setWifiOpen(true);
              }}
              className="glass flex h-14 w-full items-center justify-center gap-2 rounded-2xl font-medium active:scale-[0.98]"
            >
              Conectar ao Wi-Fi <ChevronRight className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      <Sheet open={wifiOpen} onClose={() => setWifiOpen(false)}>
        <div className="flex items-center gap-3">
          <div className="glass flex h-11 w-11 items-center justify-center rounded-full">
            <Wifi className="h-5 w-5 text-gold" />
          </div>
          <h2 className="text-3xl">Wi-Fi da casa</h2>
        </div>
        <dl className="mt-6 space-y-3">
          <div className="rounded-xl bg-secondary p-4">
            <dt className="text-xs text-muted-foreground">Rede</dt>
            <dd className="mt-1 font-semibold">{tenant.wifi_ssid}</dd>
          </div>
          <div className="rounded-xl bg-secondary p-4">
            <dt className="text-xs text-muted-foreground">Senha</dt>
            <dd className="mt-1 font-mono font-semibold">{tenant.wifi_password}</dd>
          </div>
        </dl>
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(tenant.wifi_password ?? "");
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className={`mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl font-semibold transition ${copied ? "bg-success text-success-foreground" : "bg-primary text-primary-foreground"}`}
        >
          {copied ? (
            <>
              <Check className="h-5 w-5" /> Senha copiada
            </>
          ) : (
            <>
              <Copy className="h-5 w-5" /> Copiar Senha
            </>
          )}
        </button>
      </Sheet>
    </main>
  );
}

function Sheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`fixed inset-0 z-50 transition ${open ? "pointer-events-auto" : "pointer-events-none"}`}
    >
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-scrim transition-opacity duration-300 ${open ? "opacity-70" : "opacity-0"}`}
      />
      <div
        className={`absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-3xl border-t border-glass-border bg-card px-6 pb-8 pt-3 transition-transform duration-300 ease-out ${open ? "translate-y-0" : "translate-y-full"}`}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted" />
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground"
          aria-label="Fechar"
        >
          <X className="h-5 w-5" />
        </button>
        {children}
      </div>
    </div>
  );
}

function Feed({
  categories,
  products,
  onBack,
}: {
  categories: Tables<"categories">[];
  products: Product[];
  onBack: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeCat, setActiveCat] = useState<string | null>(products[0]?.category_id ?? null);
  const [customizing, setCustomizing] = useState<Product | null>(null);
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const lastIndex = useRef(0);

  const usedCats = useMemo(
    () => categories.filter((c) => products.some((p) => p.category_id === c.id)),
    [categories, products],
  );

  /** Pílula de categoria clicada: rola até o primeiro prato dela e registra o evento. */
  function jumpTo(catId: string) {
    const idx = products.findIndex((p) => p.category_id === catId);
    const el = scrollRef.current?.children[idx] as HTMLElement | undefined;
    el?.scrollIntoView({ behavior: "smooth" });
    track("category_change", { category_id: catId, metadata: { source: "pill" } });
  }

  /** Card entrou em foco: atualiza a pílula ativa e conta o swipe (direção). */
  function onFocus(p: Product, index: number) {
    if (index !== lastIndex.current) {
      track("swipe", {
        product_id: p.id,
        metadata: { direction: index > lastIndex.current ? "down" : "up" },
      });
      lastIndex.current = index;
    }
    setActiveCat(p.category_id);
  }

  return (
    <main className="relative h-dvh">
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 bg-top-scrim pb-8 pt-4">
        <div className="pointer-events-auto flex items-center gap-2 px-4">
          <button
            onClick={onBack}
            className="glass flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            aria-label="Voltar"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <nav className="no-scrollbar flex gap-2 overflow-x-auto">
            {usedCats.map((c) => (
              <button
                key={c.id}
                onClick={() => jumpTo(c.id)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${activeCat === c.id ? "bg-primary text-primary-foreground" : "glass"}`}
              >
                {c.name}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <div ref={scrollRef} className="no-scrollbar h-dvh snap-y snap-mandatory overflow-y-scroll">
        {products.map((p, i) => (
          <ProductCard
            key={p.id}
            product={p}
            fav={favs.has(p.id)}
            onFocus={() => onFocus(p, i)}
            onFav={() => {
              const next = new Set(favs);
              if (next.has(p.id)) next.delete(p.id);
              else {
                next.add(p.id);
                track("favorite", { product_id: p.id, category_id: p.category_id });
              }
              setFavs(next);
            }}
            onCustomize={() => {
              track("customize_open", { product_id: p.id, category_id: p.category_id });
              setCustomizing(p);
            }}
          />
        ))}
        {products.length === 0 && (
          <div className="flex h-dvh items-center justify-center text-muted-foreground">
            Cardápio em preparação.
          </div>
        )}
      </div>

      <CustomizeSheet product={customizing} onClose={() => setCustomizing(null)} />
    </main>
  );
}

function ProductCard({
  product,
  fav,
  onFav,
  onCustomize,
  onFocus,
}: {
  product: Product;
  fav: boolean;
  onFav: () => void;
  onCustomize: () => void;
  onFocus: () => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const onFocusRef = useRef(onFocus);
  onFocusRef.current = onFocus;
  const mods = (product.modifiers as ModifierGroup[] | null) ?? [];

  // ── MOTOR DE ATENÇÃO (o coração da "inteligência" que vendemos) ─────────
  // Cronometra QUANTO TEMPO o prato ficou em foco real:
  //   • "em foco" = ≥65% do card visível (IntersectionObserver th 0.65);
  //   • o cronômetro PAUSA quando a aba fica oculta (cliente atende uma
  //     ligação, trava o celular) e retoma ao voltar — sem isso, o tempo
  //     de "esquecido no bolso" contaria como atenção;
  //   • ao SAIR do foco, dispara product_view com duration_ms — que o
  //     telemetry.ts descarta se estiver fora da janela 400ms–120s
  //     (scroll acidental / celular esquecido na mesa).
  // onFocusRef: mantém o callback fresco sem reinstalar o observer.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let start: number | null = null;
    let inView = false;
    const end = () => {
      if (start != null) {
        track("product_view", {
          product_id: product.id,
          category_id: product.category_id,
          duration_ms: performance.now() - start,
        });
        start = null;
      }
    };
    const io = new IntersectionObserver(
      ([entry]) => {
        inView = !!entry && entry.isIntersecting && entry.intersectionRatio >= 0.65;
        if (inView) {
          if (start == null && document.visibilityState === "visible") start = performance.now();
          onFocusRef.current();
        } else end();
      },
      { threshold: 0.65 },
    );
    const onVis = () => {
      if (document.visibilityState === "hidden") end();
      else if (inView && start == null) start = performance.now();
    };
    io.observe(el);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      end();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [product.id, product.category_id]);

  const photos = productPhotos(
    product.media_url,
    product.media_type,
    parseGallery(product.media_gallery),
  );
  const [photoIdx, setPhotoIdx] = useState(0);
  return (
    <section ref={ref} className="relative h-dvh w-full snap-start snap-always overflow-hidden">
      {photos.length > 0 && (
        <div
          className="no-scrollbar absolute inset-0 flex snap-x snap-mandatory overflow-x-scroll"
          onScroll={(e) => {
            const el = e.currentTarget;
            const idx = Math.round(el.scrollLeft / el.clientWidth);
            if (idx !== photoIdx) setPhotoIdx(idx);
          }}
        >
          {photos.map((ph, i) => (
            <div key={`${ph.url}-${i}`} className="relative h-full w-full shrink-0 snap-center">
              {ph.type === "video" ? (
                <video
                  src={resolveMedia(ph.url)}
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="h-full w-full object-cover"
                />
              ) : (
                <img
                  src={resolveMedia(ph.url)}
                  alt={product.name}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              )}
            </div>
          ))}
        </div>
      )}
      {photos.length > 1 && (
        <div className="pointer-events-none absolute inset-x-0 top-4 z-10 flex justify-center gap-1.5">
          {photos.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === photoIdx ? "w-4 bg-white" : "w-1.5 bg-white/50"}`}
            />
          ))}
        </div>
      )}
      <div className="absolute inset-0 bg-card-scrim" />
      <div className="absolute inset-x-0 bottom-0 flex items-end gap-4 px-5 pb-10">
        <div className="min-w-0 flex-1">
          {product.is_featured && (
            <span className="text-[10px] uppercase tracking-[0.3em] text-gold">
              Destaque da casa
            </span>
          )}
          <h2 className="mt-1 text-4xl leading-[1.05]">{product.name}</h2>
          {product.description && (
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {product.description}
            </p>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="glass rounded-full px-4 py-2 text-sm font-semibold">
              {formatMoney(product.price_cents)}
            </span>
            {mods.length > 0 && (
              <button
                onClick={onCustomize}
                className="flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground active:scale-95"
              >
                Personalizar <Plus className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        <button
          onClick={onFav}
          aria-label="Favoritar"
          className="glass flex h-14 w-14 shrink-0 items-center justify-center rounded-full active:scale-90"
        >
          <Heart
            className={`h-6 w-6 transition ${fav ? "fill-destructive text-destructive" : ""}`}
          />
        </button>
      </div>
    </section>
  );
}

/**
 * Gaveta "Deixe do seu jeito": o cliente testa adicionais (aveia, shot extra…)
 * e vê o total ao vivo. O `last` mantém o prato renderizado durante a animação
 * de saída — sem isso a gaveta fecharia vazia antes de deslizar fora.
 */
function CustomizeSheet({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [last, setLast] = useState<Product | null>(null);
  useEffect(() => {
    if (product) {
      setLast(product);
      setPicked({});
    }
  }, [product]);
  const p = product ?? last;
  const mods = (p?.modifiers as ModifierGroup[] | null) ?? [];
  const total = (p?.price_cents ?? 0) + Object.values(picked).reduce((a, b) => a + b, 0);

  function toggle(group: string, name: string, price: number) {
    const key = `${group}::${name}`;
    const next = { ...picked };
    if (key in next) delete next[key];
    else {
      next[key] = price;
      if (p)
        track("modifier_select", {
          product_id: p.id,
          category_id: p.category_id,
          metadata: { group, option: name, price_cents: price },
        });
    }
    setPicked(next);
  }

  return (
    <Sheet open={!!product} onClose={onClose}>
      {p && (
        <>
          <p className="text-xs uppercase tracking-[0.25em] text-gold">Deixe do seu jeito</p>
          <h2 className="mt-1 text-3xl">{p.name}</h2>
          <div className="mt-6 space-y-6">
            {mods.map((g) => (
              <div key={g.group}>
                <p className="mb-2 text-sm font-semibold text-muted-foreground">{g.group}</p>
                <div className="space-y-2">
                  {g.options.map((o) => {
                    const on = `${g.group}::${o.name}` in picked;
                    return (
                      <button
                        key={o.name}
                        onClick={() => toggle(g.group, o.name, o.price_cents)}
                        className={`flex w-full items-center justify-between rounded-xl border px-4 py-3.5 text-left transition ${on ? "border-gold bg-accent" : "border-border bg-secondary"}`}
                      >
                        <span className="flex items-center gap-3">
                          <span
                            className={`flex h-5 w-5 items-center justify-center rounded-full border ${on ? "border-gold bg-gold text-primary-foreground" : "border-muted-foreground"}`}
                          >
                            {on && <Check className="h-3 w-3" />}
                          </span>
                          {o.name}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          + {formatMoney(o.price_cents)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 flex items-center justify-between rounded-2xl bg-primary px-5 py-4 text-primary-foreground">
            <span className="text-sm font-medium">Total</span>
            <span className="text-xl font-bold tabular-nums">{formatMoney(total)}</span>
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Mostre ao atendente para fazer o pedido.
          </p>
        </>
      )}
    </Sheet>
  );
}
