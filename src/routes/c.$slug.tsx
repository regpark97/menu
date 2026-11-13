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
import { resolveMedia, parseGallery, productPhotos, type ModifierGroup } from "@/lib/format";
import { initTelemetry, track } from "@/lib/telemetry";
import { LanguageSelector } from "@/components/LanguageSelector";
import {
  MenuLanguageProvider,
  MenuContentProvider,
  useMenuLanguage,
  useMenuText,
} from "@/hooks/use-menu-language";
import { moneyText } from "@/lib/menu-i18n";
import { syncMenuVideoPlayback } from "@/lib/menu-video";
import { categoryProgress } from "@/lib/category-progress";
import type { Tables } from "@/integrations/supabase/types";

type Product = Tables<"public_menu_products">;
type Tenant = Tables<"public_menu">;
type Category = Tables<"public_menu_children">;

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
  return (
    <MenuLanguageProvider>
      <CustomerContent />
    </MenuLanguageProvider>
  );
}

function CustomerContent() {
  const { locale, setLocale } = useMenuLanguage();
  const { slug } = Route.useParams();
  const { t } = Route.useSearch();
  const [screen, setScreen] = useState<"hub" | "feed">("hub");

  const { data, isLoading } = useQuery({
    queryKey: ["menu", slug],
    queryFn: async () => {
      // View pública enxuta (migration 0009): sem wifi_password, plan, owner.
      // A senha do Wi-Fi vem sob demanda via RPC tenant_wifi ao abrir o modal.
      const { data: tenant } = await supabase
        .from("public_menu")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (!tenant) return null;
      const [cats, prods] = await Promise.all([
        supabase
          .from("public_menu_children")
          .select("*")
          .eq("tenant_id", tenant.id)
          .order("sort_order"),
        supabase
          .from("public_menu_products")
          .select("*")
          .eq("tenant_id", tenant.id)
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
  if (!data) return <TranslatedNotFound />;

  return (
    <MenuContentProvider categories={data.categories} products={data.products}>
      <LanguageSelector locale={locale} onChange={setLocale} />
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
    </MenuContentProvider>
  );
}

function TranslatedNotFound() {
  const { t } = useMenuLanguage();
  return (
    <div className="flex h-dvh items-center justify-center px-6 text-center text-muted-foreground">
      {t("notFound")}
    </div>
  );
}

function Hub({
  tenant,
  table,
  onExplore,
}: {
  tenant: Tenant;
  table?: string | undefined;
  onExplore: () => void;
}) {
  const [wifiOpen, setWifiOpen] = useState(false);
  const { t, locale } = useMenuLanguage();
  const [copied, setCopied] = useState(false);
  // Senha buscada sob demanda (RPC tenant_wifi) — não vem mais no select inicial.
  const [wifiPwd, setWifiPwd] = useState<string | null>(null);
  const bg = resolveMedia(tenant.bg_image_url);
  const isVideo = /\.(mp4|webm|mov)(\?|$)/i.test(bg);

  async function openWifi() {
    setWifiOpen(true);
    if (wifiPwd === null) {
      const { data } = await supabase.rpc("tenant_wifi", { _slug: tenant.slug });
      setWifiPwd(data?.[0]?.password ?? "");
    }
  }

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
            {t("table", table)}
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
            {t("explore")} <ArrowRight className="h-5 w-5" />
          </button>
          {tenant.google_review_url && (
            <a
              href={tenant.google_review_url}
              target="_blank"
              rel="noreferrer"
              onClick={() => track("review_click")}
              className="glass flex h-14 w-full items-center justify-center gap-2 rounded-2xl font-medium active:scale-[0.98]"
            >
              {t("reviews")} <ArrowUpRight className="h-5 w-5" />
            </a>
          )}
          {tenant.wifi_ssid && (
            <button
              onClick={() => {
                track("wifi_open");
                void openWifi();
              }}
              className="glass flex h-14 w-full items-center justify-center gap-2 rounded-2xl font-medium active:scale-[0.98]"
            >
              {t("wifiConnect")} <ChevronRight className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      <Sheet open={wifiOpen} onClose={() => setWifiOpen(false)}>
        <div className="flex items-center gap-3">
          <div className="glass flex h-11 w-11 items-center justify-center rounded-full">
            <Wifi className="h-5 w-5 text-gold" />
          </div>
          <h2 className="text-3xl">{t("wifiTitle")}</h2>
        </div>
        <dl className="mt-6 space-y-3">
          <div className="rounded-xl bg-secondary p-4">
            <dt className="text-xs text-muted-foreground">{t("wifiNetwork")}</dt>
            <dd className="mt-1 font-semibold">{tenant.wifi_ssid}</dd>
          </div>
          <div className="rounded-xl bg-secondary p-4">
            <dt className="text-xs text-muted-foreground">{t("wifiPassword")}</dt>
            <dd className="mt-1 font-mono font-semibold">
              {wifiPwd === null ? "…" : wifiPwd || t("unset")}
            </dd>
          </div>
        </dl>
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(wifiPwd ?? "");
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className={`mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl font-semibold transition ${copied ? "bg-success text-success-foreground" : "bg-primary text-primary-foreground"}`}
        >
          {copied ? (
            <>
              <Check className="h-5 w-5" /> {t("copiedPassword")}
            </>
          ) : (
            <>
              <Copy className="h-5 w-5" /> {t("copyPassword")}
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
  const { t } = useMenuLanguage();
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
          aria-label={t("close")}
        >
          <X className="h-5 w-5" />
        </button>
        {children}
      </div>
    </div>
  );
}

export function Feed({
  categories,
  products,
  onBack,
}: {
  categories: Category[];
  products: Product[];
  onBack: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { t } = useMenuLanguage();
  const { text } = useMenuText();
  const [activeCat, setActiveCat] = useState<string | null>(products[0]?.category_id ?? null);
  const [customizing, setCustomizing] = useState<Product | null>(null);
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const lastIndex = useRef(0);

  const usedCats = useMemo(
    () => categories.filter((c) => products.some((p) => p.category_id === c.id)),
    [categories, products],
  );
  const catsRef = useRef<HTMLElement>(null);
  const [catIndicator, setCatIndicator] = useState({ visible: false, left: 0, width: 100 });

  /** A régua só existe quando as pílulas não cabem; acompanha arraste e tradução. */
  useEffect(() => {
    const nav = catsRef.current;
    if (!nav) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = categoryProgress(nav.clientWidth, nav.scrollWidth, nav.scrollLeft);
        setCatIndicator((current) =>
          current.visible === next.visible &&
          Math.abs(current.left - next.left) < 0.1 &&
          Math.abs(current.width - next.width) < 0.1
            ? current
            : next,
        );
      });
    };
    update();
    nav.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(nav);
    Array.from(nav.children).forEach((child) => observer?.observe(child));
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      nav.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [usedCats, text]);

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
        <div className="pointer-events-auto relative flex items-center gap-2 px-4 pr-14">
          <button
            onClick={onBack}
            className="glass flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            aria-label={t("back")}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <nav ref={catsRef} className="no-scrollbar min-w-0 flex-1 flex gap-2 overflow-x-auto">
            {usedCats.map((c) => (
              <button
                key={c.id}
                onClick={() => jumpTo(c.id)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${activeCat === c.id ? "bg-primary text-primary-foreground" : "glass"}`}
              >
                {text(c.name)}
              </button>
            ))}
          </nav>
          {catIndicator.visible && (
            <span
              className="pointer-events-none absolute -bottom-1 left-1/2 h-[3px] w-12 -translate-x-1/2 rounded-full bg-white/15"
              aria-hidden="true"
            >
              <span
                className="absolute inset-y-0 rounded-full bg-gold/60 transition-[left] duration-150"
                style={{ left: `${catIndicator.left}%`, width: `${catIndicator.width}%` }}
              />
            </span>
          )}
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
            {t("preparing")}
          </div>
        )}
      </div>

      <CustomizeSheet product={customizing} onClose={() => setCustomizing(null)} />
    </main>
  );
}

/** Cada vídeo observa sua própria visibilidade: vale para o scroll vertical e a galeria. */
function MenuVideo({ src, label }: { src: string; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    let inView = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        const visible = entry.isIntersecting && entry.intersectionRatio >= 0.65;
        if (visible === inView) return;
        inView = visible;
        syncMenuVideoPlayback(video, visible);
      },
      { threshold: 0.65 },
    );
    observer.observe(video);
    return () => {
      observer.disconnect();
      video.pause();
    };
  }, [src]);
  return (
    <video
      ref={ref}
      src={src}
      aria-label={label}
      muted
      loop
      playsInline
      preload="metadata"
      className="h-full w-full object-cover"
    />
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
  const { t, locale } = useMenuLanguage();
  const { text } = useMenuText();
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
                <MenuVideo src={resolveMedia(ph.url)} label={product.name} />
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
              {t("featured")}
            </span>
          )}
          <h2 className="mt-1 text-4xl leading-[1.05]">{text(product.name)}</h2>
          {product.description && (
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {text(product.description)}
            </p>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="glass rounded-full px-4 py-2 text-sm font-semibold">
              {moneyText(product.price_cents, locale)}
            </span>
            {mods.length > 0 && (
              <button
                onClick={onCustomize}
                className="flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground active:scale-95"
              >
                {t("customize")} <Plus className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        <button
          onClick={onFav}
          aria-label={t("favorite")}
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
  const { t, locale } = useMenuLanguage();
  const { text } = useMenuText();
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
          <p className="text-xs uppercase tracking-[0.25em] text-gold">{t("yourWay")}</p>
          <h2 className="mt-1 text-3xl">{text(p.name)}</h2>
          <div className="mt-6 space-y-6">
            {mods.map((g) => (
              <div key={g.group}>
                <p className="mb-2 text-sm font-semibold text-muted-foreground">{text(g.group)}</p>
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
                          {text(o.name)}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          + {moneyText(o.price_cents, locale)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 flex items-center justify-between rounded-2xl bg-primary px-5 py-4 text-primary-foreground">
            <span className="text-sm font-medium">{t("total")}</span>
            <span className="text-xl font-bold tabular-nums">{moneyText(total, locale)}</span>
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground">{t("showWaiter")}</p>
        </>
      )}
    </Sheet>
  );
}
