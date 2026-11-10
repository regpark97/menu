import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Smartphone, Zap, ShieldCheck, Wifi, Star, ChevronDown, Heart, X,
  DollarSign, BadgeCheck, ImageIcon, Search, Sun, Moon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import "./lp.css";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BUPIN — Da mesa ao dashboard" },
      {
        name: "description",
        content:
          "Cardápio vertical com NFC para restaurantes e cafés. O cliente desliza pelos pratos; você enxerga, em números, o que prende a atenção.",
      },
      { property: "og:title", content: "BUPIN — Da mesa ao dashboard" },
      {
        property: "og:description",
        content: "O cardápio que prende a atenção. E mostra por quê.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,700;1,9..144,500&family=Archivo+Black&family=Sora:wght@300;400;600;700&display=swap",
      },
    ],
  }),
  component: Landing,
});

/* ── dados do mockup ─────────────────────────────────────────── */
const FEED = [
  {
    cat: "tacos", label: "Taquería · La Cantina del Sol",
    name: "Taco de Asada", desc: "Carne assada na brasa, cebola caramelizada e salsa verde",
    price: "R$ 49", video: "/landing/videos/asada.mp4",
  },
  {
    cat: "burritos", label: "Taquería · La Cantina del Sol",
    name: "Burrito de Camarão", desc: "Camarão empanado, arroz chipotle e guacamole fresco",
    price: "R$ 59", video: "/landing/videos/camarao.mp4",
  },
  {
    cat: "tacos", label: "Taquería · La Cantina del Sol",
    name: "Taco de Pescado", desc: "Peixe do dia em crosta de milho com maionese de limão",
    price: "R$ 49", video: "/landing/videos/pescado.mp4",
  },
  {
    cat: "especialidades", label: "Taquería · La Cantina del Sol",
    name: "Chimichanga", desc: "Tortilla dourada recheada, com molho de queijo e pico de gallo",
    price: "R$ 29", video: "/landing/videos/chimichanga.mp4",
  },
];

const CATS = [
  { id: "destaques", label: "Destaques" },
  { id: "tacos", label: "Tacos" },
  { id: "burritos", label: "Burritos" },
  { id: "especialidades", label: "Especialidades" },
];

const SEGMENTS = [
  ["", "Selecione o segmento"],
  ["cafe", "Cafeteria / Coffee shop"],
  ["restaurante", "Restaurante"],
  ["bar", "Bar / Boteco"],
  ["hamburgueria", "Hamburgueria"],
  ["pizzaria", "Pizzaria"],
  ["doceria", "Doceria / Confeitaria"],
  ["sorveteria", "Sorveteria / Açaí"],
  ["foodtruck", "Food truck"],
  ["outro", "Outro"],
];

/* ── helpers ──────────────────────────────────────────────────── */
/** Tema da LP: escuro por padrão (igual ao cardápio), alternável pro claro.
 *  Persistido em localStorage (mesma chave/estratégia do use-theme do app). */
const THEME_KEY = "bupin-lp-theme";
function useLpTheme() {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") return "dark";
    try { return (localStorage.getItem(THEME_KEY) as "dark" | "light") || "dark"; }
    catch { return "dark"; }
  });
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (rootRef.current) rootRef.current.setAttribute("data-theme", theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* modo privado */ }
  }, [theme]);
  return { theme, setTheme, rootRef };
}

function useReveal() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("visible");
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.12 }
    );
    document.querySelectorAll(".bupin-lp .reveal").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

function useNavScroll() {
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const onScroll = () =>
      navRef.current?.classList.toggle("scrolled", window.scrollY > 10);
    addEventListener("scroll", onScroll, { passive: true });
    return () => removeEventListener("scroll", onScroll);
  }, []);
  return navRef;
}

function useBarsAnimation() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            el.querySelectorAll<HTMLElement>(".fill").forEach((f, i) => {
              setTimeout(() => (f.style.height = f.dataset.h + "%"), i * 110);
            });
            io.disconnect();
          }
        });
      },
      { threshold: 0.3 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

/* ── phone mockup com auto-scroll + categoria sincronizada ───── */
function PhoneMockup() {
  const feedRef = useRef<HTMLDivElement>(null);
  const [activeCat, setActiveCat] = useState("destaques");
  const indexRef = useRef(0);

  useEffect(() => {
    const feed = feedRef.current;
    if (!feed) return;
    const cards = [...feed.querySelectorAll<HTMLElement>(".blp-card")];
    let timer: number | undefined;

    const syncPill = () => {
      const card = cards[indexRef.current];
      if (card) setActiveCat(card.dataset.cat || "destaques");
    };

    const startAuto = () => {
      window.clearInterval(timer);
      timer = window.setInterval(() => {
        indexRef.current = (indexRef.current + 1) % cards.length;
        feed.scrollTo({ top: indexRef.current * feed.clientHeight, behavior: "smooth" });
        syncPill();
      }, 4200);
    };
    const stopAuto = () => window.clearInterval(timer);

    // scroll manual também sincroniza
    const onScroll = () => {
      const i = Math.round(feed.scrollTop / feed.clientHeight);
      if (i !== indexRef.current && i >= 0 && i < cards.length) {
        indexRef.current = i;
        syncPill();
      }
    };
    feed.addEventListener("scroll", onScroll, { passive: true });

    // pausa quando interage
    let resume: number;
    const pause = () => {
      stopAuto();
      window.clearTimeout(resume);
      resume = window.setTimeout(startAuto, 6000);
    };
    const phone = feed.closest(".blp-phone");
    phone?.addEventListener("mouseenter", pause);
    phone?.addEventListener("touchstart", pause, { passive: true });
    feed.addEventListener("wheel", pause, { passive: true });

    // vídeo só roda no card em foco
    cards.forEach((card) => {
      const video = card.querySelector("video");
      if (!video) return;
      const vio = new IntersectionObserver(
        (entries) =>
          entries.forEach((e) => {
            if (e.isIntersecting) video.play().catch(() => {});
            else video.pause();
          }),
        { threshold: 0.5, root: feed }
      );
      vio.observe(card);
    });

    startAuto();
    return () => {
      stopAuto();
      window.clearTimeout(resume);
      feed.removeEventListener("scroll", onScroll);
      phone?.removeEventListener("mouseenter", pause);
      phone?.removeEventListener("touchstart", pause);
      feed.removeEventListener("wheel", pause);
    };
  }, []);

  return (
    <div className="blp-phone-wrap">
      <div className="blp-phone">
        <div className="blp-topbar">
          {CATS.map((c) => (
            <span key={c.id} className={activeCat === c.id ? "on" : ""}>
              {c.label}
            </span>
          ))}
        </div>
        <div className="blp-feed" ref={feedRef}>
          {FEED.map((item) => (
            <div className="blp-card" data-cat={item.cat} key={item.name}>
              <video src={item.video} muted loop playsInline autoPlay preload="auto" />
              <span className="blp-heart" aria-label="Favoritar">
                <Heart size={17} fill="currentColor" />
              </span>
              <div className="blp-info">
                <div className="blp-cat">{item.label}</div>
                <div className="blp-name">{item.name}</div>
                <div className="blp-desc">{item.desc}</div>
                <div className="blp-row">
                  <span className="blp-price">{item.price}</span>
                  <span className="blp-pill">Personalizar +</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── formulário de leads (Supabase) ───────────────────────────── */
type FormState = {
  establishment: string; owner: string; phone: string; email: string; segment: string;
};

function LeadForm() {
  const [values, setValues] = useState<FormState>({
    establishment: "", owner: "", phone: "", email: "", segment: "",
  });
  const [invalid, setInvalid] = useState<Partial<Record<keyof FormState, boolean>>>({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof FormState) => (v: string) => setValues((s) => ({ ...s, [k]: v }));

  const maskPhone = (raw: string) => {
    let v = raw.replace(/\D/g, "").slice(0, 11);
    if (v.length > 6)
      v = v.length === 11
        ? `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`
        : `(${v.slice(0, 2)}) ${v.slice(2, 6)}-${v.slice(6)}`;
    else if (v.length > 2) v = `(${v.slice(0, 2)}) ${v.slice(2)}`;
    else if (v.length > 0) v = `(${v}`;
    return v;
  };

  const validate = () => {
    const errs: Partial<Record<keyof FormState, boolean>> = {};
    if (values.establishment.trim().length < 2) errs.establishment = true;
    if (values.owner.trim().length < 2) errs.owner = true;
    if (values.phone.replace(/\D/g, "").length < 10) errs.phone = true;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errs.email = true;
    if (!values.segment) errs.segment = true;
    setInvalid(errs);
    return Object.keys(errs).length === 0;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSending(true);
    setError("");
    try {
      const { error } = await supabase.from("leads").insert({
        establishment: values.establishment.trim(),
        owner: values.owner.trim(),
        phone: values.phone,
        email: values.email.trim(),
        segment: values.segment,
      });
      if (error) throw error;
      setSent(true);
    } catch {
      setError("Não foi possível enviar agora. Tente novamente em instantes.");
    } finally {
      setSending(false);
    }
  };

  const field = (
    k: keyof FormState,
    label: string,
    input: React.ReactNode,
    err: string
  ) => (
    <div className={`blp-field ${invalid[k] ? "invalid" : ""}`}>
      <label htmlFor={`blp-${k}`}>
        {label} <span>*</span>
      </label>
      {input}
      <div className="err">{err}</div>
    </div>
  );

  if (sent) {
    return (
      <div className="blp-lead-form">
        <div className="blp-form-success show">
          <div className="check">
            <BadgeCheck size={28} />
          </div>
          <h3>Recebido! Obrigado.</h3>
          <p>Vamos entrar em contato em breve para agendar sua demonstração do BUPIN.</p>
        </div>
      </div>
    );
  }

  return (
    <form className="blp-lead-form" onSubmit={submit} noValidate>
      <div className="form-title">Quero o BUPIN no meu negócio</div>
      <div className="form-sub">
        Preencha e retornamos o contato com uma demonstração personalizada.
      </div>
      <div className="blp-fgrid">
        {field(
          "establishment",
          "Nome do estabelecimento",
          <input
            id="blp-establishment" type="text" autoComplete="organization"
            placeholder="Ex.: La Cantina del Sol" value={values.establishment}
            onChange={(e) => set("establishment")(e.target.value)}
          />,
          "Informe o nome do estabelecimento."
        )}
        <div className="blp-frow">
          {field(
            "owner",
            "Nome do proprietário",
            <input
              id="blp-owner" type="text" autoComplete="name"
              placeholder="Seu nome completo" value={values.owner}
              onChange={(e) => set("owner")(e.target.value)}
            />,
            "Informe o nome do proprietário."
          )}
          {field(
            "phone",
            "Telefone / WhatsApp",
            <input
              id="blp-phone" type="tel" inputMode="tel" autoComplete="tel"
              placeholder="(11) 99999-9999" value={values.phone}
              onChange={(e) => set("phone")(maskPhone(e.target.value))}
            />,
            "Informe um telefone válido."
          )}
        </div>
        <div className="blp-frow">
          {field(
            "email",
            "E-mail",
            <input
              id="blp-email" type="email" inputMode="email" autoComplete="email"
              placeholder="voce@seunegocio.com.br" value={values.email}
              onChange={(e) => set("email")(e.target.value)}
            />,
            "Informe um e-mail válido."
          )}
          {field(
            "segment",
            "Segmento do estabelecimento",
            <select
              id="blp-segment" value={values.segment}
              onChange={(e) => set("segment")(e.target.value)}
              className={invalid.segment ? "invalid" : ""}
            >
              {SEGMENTS.map(([v, l]) => (
                <option key={v} value={v} disabled={!v}>{l}</option>
              ))}
            </select>,
            "Selecione o segmento."
          )}
        </div>
        <button type="submit" className="blp-btn blp-btn-primary" disabled={sending}>
          {sending ? "Enviando…" : "Enviar e agendar demonstração"}
        </button>
        {error && <p style={{ color: "#d99a8a", fontSize: 13, textAlign: "center", margin: 0 }}>{error}</p>}
      </div>
      <p className="blp-form-fine">Seus dados são usados apenas para este contato. Sem spam.</p>
    </form>
  );
}

/* ── página ───────────────────────────────────────────────────── */
function Landing() {
  useReveal();
  const navRef = useNavScroll();
  const barsRef = useBarsAnimation();
  const { theme, setTheme, rootRef } = useLpTheme();

  return (
    <div className="bupin-lp" data-theme="dark" ref={rootRef}>
      {/* NAV */}
      <header className="blp-nav" ref={navRef}>
        <div className="blp-wrap blp-nav-inner">
          <a href="#topo" className="blp-logo" aria-label="BUPIN — início">
            <span className="blp-logo-mark">B</span>
            <span className="blp-logo-name">BUPIN</span>
          </a>
          <nav className="blp-nav-links">
            <a href="#como-funciona">Como funciona</a>
            <a href="#experiencia">Experiência</a>
            <a href="#metricas">Métricas</a>
            <a href="#preco">Preço</a>
            <a href="#faq">FAQ</a>
          </nav>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Link to="/auth" className="blp-btn blp-btn-link">Entrar</Link>
            <button
              className="blp-theme-toggle"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label={theme === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro"}
              title={theme === "dark" ? "Tema claro" : "Tema escuro"}
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <a href="#contato" className="blp-btn blp-btn-primary">Quero o Bupin</a>
          </div>
        </div>
      </header>

      <main>
        {/* HERO */}
        <section className="blp-hero blp-wrap" id="topo">
          <div>
            <span className="blp-eyebrow">
              <span className="dot" /> NFC na mesa · Cardápio vertical · Sem app
            </span>
            <h1>
              O cardápio que prende a atenção. <em>E mostra por quê.</em>
            </h1>
            <p className="blp-lead">
              O cliente toca o NFC da mesa e desliza pelos seus pratos como quem rola um feed.{" "}
              <strong>
                Você enxerga, em números, o que ele viu, onde ele demorou e o que favoritou.
              </strong>{" "}
              Da mesa ao dashboard.
            </p>
            <div className="blp-hero-ctas">
              <a href="#contato" className="blp-btn blp-btn-primary">
                Quero o BUPIN no meu negócio
              </a>
              <a href="#como-funciona" className="blp-btn blp-btn-ghost">
                Ver como funciona ↓
              </a>
            </div>
            <div className="blp-hero-facts">
              <span><Smartphone size={15} /> Funciona no navegador</span>
              <span><Zap size={15} /> Ativa em segundos</span>
              <span><ShieldCheck size={15} /> Marca do seu restaurante</span>
            </div>
          </div>
          <PhoneMockup />
        </section>

        {/* MARQUEE */}
        <div className="blp-marquee" aria-hidden="true">
          <div className="blp-marquee-track">
            <span>
              NFC na mesa <i>◆</i> Wi-Fi em 1 toque <i>◆</i> Google Reviews <i>◆</i> Sem app <i>◆</i>{" "}
              Cardápio vertical <i>◆</i> Tempo de atenção por prato <i>◆</i> Esgotado em 1 clique <i>◆</i>{" "}
              Tags reutilizáveis <i>◆</i>
            </span>
            <span>
              NFC na mesa <i>◆</i> Wi-Fi em 1 toque <i>◆</i> Google Reviews <i>◆</i> Sem app <i>◆</i>{" "}
              Cardápio vertical <i>◆</i> Tempo de atenção por prato <i>◆</i> Esgotado em 1 clique <i>◆</i>{" "}
              Tags reutilizáveis <i>◆</i>
            </span>
          </div>
        </div>

        {/* COMO FUNCIONA */}
        <section id="como-funciona" className="blp-wrap blp-section">
          <div className="reveal">
            <div className="blp-sec-label">Como funciona</div>
            <h2>
              Três movimentos. <em>Zero fricção.</em>
            </h2>
            <p className="blp-sec-sub">
              Do toque na mesa até a decisão do dono — o caminho inteiro acontece no navegador do
              cliente, sem baixar nada.
            </p>
          </div>
          <div className="blp-steps">
            {[
              ["1", "~2 segundos", "Toque na mesa", "O cliente encosta o celular na tag NFC (ou escaneia o QR). O cardápio abre direto no navegador, já identificado com a mesa em que ele está."],
              ["2", "Feed vertical", "Role os pratos", "Cada prato ocupa a tela inteira, com foto grande, preço e personalização. A navegação é a mesma que o cliente já conhece dos reels."],
              ["3", "No seu painel", "Veja o que importou", "Views, tempo de atenção, favoritos e personalizações por prato chegam organizados no seu painel — para decidir destaque, cardápio e margem."],
            ].map(([num, tag, title, text]) => (
              <div className="blp-step reveal" key={num}>
                <span className="num">{num}</span>
                <span className="tag">{tag}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* EXPERIÊNCIA */}
        <section id="experiencia" className="blp-wrap blp-section">
          <div className="reveal">
            <div className="blp-sec-label">A experiência na mesa</div>
            <h2>
              Um hub com a cara do seu restaurante. <em>Nada de lista PDF.</em>
            </h2>
            <p className="blp-sec-sub">
              A primeira tela que o cliente vê é sua marca — e o que ele mais precisa: cardápio,
              Wi-Fi e avaliação no Google.
            </p>
          </div>
          <div className="blp-bento">
            <div className="blp-b-item tall reveal">
              <div className="blp-b-icon"><ImageIcon size={20} /></div>
              <h3>Customer Hub com a sua marca</h3>
              <p>Fundo, logo e frase do seu estabelecimento. O cliente chega num hub elegante, não numa página genérica.</p>
              <div className="blp-mini-phone">
                <div className="blp-mini-hub-row"><span className="logo-sm">LA CANTINA DEL SOL</span></div>
                <span className="blp-mini-btn solid">Explorar cardápio →</span>
                <span className="blp-mini-btn glass">Avaliar no Google ↗</span>
                <span className="blp-mini-btn glass">Conectar ao Wi-Fi ›</span>
              </div>
            </div>
            <div className="blp-b-item reveal">
              <div className="blp-b-icon"><Wifi size={20} /></div>
              <h3>Wi-Fi sem pedir a senha</h3>
              <p>Um toque abre rede e senha prontos para copiar. Ninguém mais digita errado.</p>
              <div className="blp-mini"><span className="hl">Copiar senha em 1 toque</span></div>
            </div>
            <div className="blp-b-item reveal">
              <div className="blp-b-icon"><Star size={20} /></div>
              <h3>Google Reviews a um passo</h3>
              <p>O botão leva direto para a sua página de avaliações — no momento em que o cliente está mais satisfeito.</p>
              <div className="blp-mini"><span className="hl">Momento certo = mais reviews</span></div>
            </div>
            <div className="blp-b-item wide reveal">
              <div className="blp-b-icon"><ChevronDown size={20} /></div>
              <h3>Feed vertical, prato por prato</h3>
              <p>Foto em tela cheia, vídeo em loop, preço claro e descrição curta. O cliente navega por categorias e descobre itens que passariam despercebidos numa lista.</p>
              <div className="blp-mini">
                <span>Fotos e vídeos</span><span>Categorias em pílulas</span><span>Scroll com snap</span><span className="hl">Vídeo em loop</span>
              </div>
            </div>
            <div className="blp-b-item reveal">
              <div className="blp-b-icon"><Heart size={20} /></div>
              <h3>Favoritos e personalização</h3>
              <p>O cliente favorita o que amou e monta o pedido do jeito dele — leite de aveia, shot extra, adicionais — vendo o total ao vivo.</p>
              <div className="blp-mini"><span>♥ Favoritar</span><span className="hl">Adicionais com preço</span></div>
            </div>
            <div className="blp-b-item reveal">
              <div className="blp-b-icon"><X size={20} /></div>
              <h3>Esgotou? Um toque</h3>
              <p>O prato sai do feed na hora, sem intermediário. Quando volta, volta ao ar no mesmo toque.</p>
              <div className="blp-mini"><span className="hl">Switch disponível/esgotado</span></div>
            </div>
            <div className="blp-b-item wide reveal">
              <div className="blp-b-icon"><DollarSign size={20} /></div>
              <h3>Implementação sob medida, sem letra miúda</h3>
              <p>A taxa de implementação varia conforme o tamanho do cardápio, a quantidade de tags NFC e os ajustes de marca — você sabe exatamente o que está pagando antes de fechar.</p>
              <div className="blp-mini"><span>Setup guiado</span><span>Tags NFC vinculadas à sua operação</span><span className="hl">Sem surpresa no orçamento</span></div>
            </div>
          </div>
        </section>

        {/* MÉTRICAS */}
        <section id="metricas" className="blp-wrap blp-section">
          <div className="reveal">
            <div className="blp-sec-label">Métricas</div>
            <h2>
              O feed agrada o cliente. <em>O painel te agrada.</em>
            </h2>
            <p className="blp-sec-sub">
              Cada gesto no cardápio vira sinal: o que foi visto, quanto tempo prendeu atenção, o
              que foi favoritado e personalizado.
            </p>
          </div>
          <div className="blp-dash reveal">
            <div className="blp-dash-head">
              <div className="t">
                Inteligência
                <small>Últimos 15 dias · estabelecimento demonstrativo</small>
              </div>
              <div className="blp-filters">
                <span>7d</span><span className="on">15d</span><span>30d</span>
              </div>
            </div>
            <div className="blp-stats">
              <div className="blp-stat hi"><div className="v">412</div><div className="k">Sessões abertas</div></div>
              <div className="blp-stat"><div className="v">2.140</div><div className="k">Views de pratos</div></div>
              <div className="blp-stat"><div className="v">87</div><div className="k">Cliques no Google</div></div>
              <div className="blp-stat"><div className="v">153</div><div className="k">Aberturas de Wi-Fi</div></div>
            </div>
            <div className="blp-bars" ref={barsRef}>
              {[
                ["14.2s", "88", "Taco de<br>Asada", true],
                ["11.6s", "72", "Burrito de<br>Camarão", false],
                ["10.8s", "66", "Chimichanga", true],
                ["7.4s", "46", "Taco de<br>Pescado", false],
                ["5.9s", "36", "Quesadilla", false],
                ["4.1s", "25", "Guacamole", false],
              ].map(([val, h, lab, top]) => (
                <div className={`blp-bar ${top ? "top" : ""}`} key={lab as string}>
                  <span className="val">{val}</span>
                  <div className="fill" data-h={h} />
                  <span className="lab" dangerouslySetInnerHTML={{ __html: lab as string }} />
                </div>
              ))}
            </div>
            <div className="blp-dash-note">
              <Search size={14} />
              Tempo médio de atenção estimado a partir da sequência de visualização/saída de cada
              prato. Dados ilustrativos — não são garantia de vendas.
            </div>
          </div>

          <div className="blp-band reveal">
            <div>
              <div className="blp-sec-label">Decisões melhores</div>
              <h2>
                Um prato chama atenção e ninguém percebe. <em>Agora você percebe.</em>
              </h2>
            </div>
            <ul>
              {[
                ["Reposicionar o cardápio:", " o item com maior atenção pode subir de categoria ou ganhar destaque."],
                ["Testar preço e margem:", " compare atenção por prato com o que você já sabe da sua operação."],
                ["Personalizações que vendem:", " veja quais adicionais o cliente mais abre — e quais nunca são tocados."],
                ["Horário de pico de interesse:", " entenda quando cada categoria desperta mais atenção para planejar promoções."],
              ].map(([b, rest]) => (
                <li key={b}>
                  <BadgeCheck size={16} />
                  <span><strong>{b}</strong>{rest}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* PREÇO */}
        <section id="preco" className="blp-wrap blp-section">
          <div className="reveal" style={{ textAlign: "center" }}>
            <div className="blp-sec-label">Investimento</div>
            <h2 style={{ margin: "0 auto" }}>
              Um plano. <em>Sem pegadinha.</em>
            </h2>
          </div>
          <div className="blp-price-card reveal">
            <div className="plan">BUPIN Completo</div>
            <div className="amount">R$ 297<small>/mês</small></div>
            <div className="impl">
              + taxa de implementação sob medida (variável conforme cardápio, nº de tags e personalização)
            </div>
            <ul>
              {[
                "Cardápio vertical completo — fotos, vídeos e sua marca",
                "Customer Hub com Wi-Fi e Google Reviews",
                "Painel de métricas: views, atenção, favoritos, personalizações",
                "Gestão de cardápio em tempo real (esgotado, preço, descrição)",
                "Tags NFC configuráveis e reutilizáveis",
                "Upload de fotos com curadoria de qualidade",
              ].map((f) => (
                <li key={f}><BadgeCheck size={15} /> {f}</li>
              ))}
            </ul>
            <a href="#contato" className="blp-btn blp-btn-primary">
              Quero o BUPIN no meu negócio
            </a>
            <p className="fine">Valores em reais. A implementação é orçada antes de fechar — você aprova tudo antes.</p>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="blp-wrap blp-section">
          <div className="reveal" style={{ textAlign: "center" }}>
            <div className="blp-sec-label">FAQ</div>
            <h2 style={{ margin: "0 auto" }}>
              Perguntas de quem <em>tá na mesa.</em>
            </h2>
          </div>
          <div className="blp-faq">
            {[
              ["O cliente precisa baixar algum app?", "Não. Tudo abre no navegador com o toque no NFC ou o scan do QR. Sem download, sem cadastro, sem atrito.", true],
              ["E se o cliente não tiver NFC no celular?", "Cada mesa também tem um QR Code de fallback. Os dois caminhos chegam no mesmo lugar — inclusive em mesas diferentes.", false],
              ["Como funciona a troca de cardápio no dia a dia?", "Pelo painel: preço, descrição e disponibilidade você edita sozinho em segundos, direto do celular. Esgotou um prato? Um toque e ele sai do feed na hora.", false],
              ["As fotos que eu enviar vão direto pro ar?", "Suas novas fotos passam por uma curadoria rápida de enquadramento e qualidade antes de substituir as atuais — para o feed nunca perder o padrão visual. O cardápio continua no ar com a foto antiga até a nova ser aprovada.", false],
              ["O que exatamente é medido? É invasivo?", "Medimos sinais de navegação anônimos: views por prato, tempo de atenção, troca de categoria, favoritos e personalizações. Não há identificação individual do cliente — é comportamento agregado, não perfil pessoal.", false],
              ["As tags NFC são minhas? E se eu mudar de cardápio ou de mesa?", "As tags são reconfiguráveis: cada uma aponta dinamicamente para a mesa e o estabelecimento definidos no painel. Mudou o layout da sala? Revincula a tag — sem regravar nada.", false],
              ["Serve só para restaurante?", "O formato nasceu em restaurantes e cafés, mas funciona para qualquer cardápio visual: bares, hamburguerias, sorveterias, food trucks. Se o seu produto é bonito, ele merece tela inteira.", false],
            ].map(([q, a, open]) => (
              <details key={q as string} open={!!open}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* CTA FINAL + FORM */}
        <section className="blp-final" id="contato">
          <div className="reveal">
            <div className="blp-sec-label">Próximo passo</div>
            <h2>
              Seu cardápio já é bom. <em>Agora ele vai render dados.</em>
            </h2>
            <p className="blp-final-sub">
              Fale com a gente e veja o BUPIN funcionando com os pratos do seu próprio
              estabelecimento antes de decidir.
            </p>
          </div>
          <LeadForm />
        </section>
      </main>

      {/* FOOTER */}
      <footer className="blp-footer">
        <div className="blp-wrap blp-foot">
          <a href="#topo" className="blp-logo" aria-label="BUPIN">
            <span className="blp-logo-mark">B</span>
            <span className="blp-logo-name">BUPIN</span>
          </a>
          <span className="tagline">Da mesa ao dashboard.</span>
          <span>© {new Date().getFullYear()} BUPIN · Feito no Brasil</span>
        </div>
        <div className="blp-wrap blp-demo-links">
          <Link to="/auth">Entrar</Link>
        </div>
      </footer>
    </div>
  );
}
