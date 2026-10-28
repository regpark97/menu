import { createFileRoute, Link } from "@tanstack/react-router";
import { Nfc, LayoutDashboard, ShieldCheck, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bupin — Cardápio vertical ativado por NFC" },
      {
        name: "description",
        content:
          "Encoste o celular na mesa e descubra o cardápio em vídeo. Wi-Fi, Google Reviews e inteligência de atenção por prato.",
      },
      { property: "og:title", content: "Bupin — Cardápio vertical ativado por NFC" },
      {
        property: "og:description",
        content:
          "Cardápio estilo Reels, Customer Hub e métricas de atenção para cafés e restaurantes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const items = [
    {
      to: "/t/$tag" as const,
      params: { tag: "tag-001" },
      icon: Nfc,
      title: "Experiência na mesa",
      text: "Simula o toque no cartão NFC de uma mesa do cliente.",
    },
    {
      to: "/admin" as const,
      icon: LayoutDashboard,
      title: "Painel do restaurante",
      text: "Cardápio rápido, fotos e métricas.",
    },
    {
      to: "/super-admin" as const,
      icon: ShieldCheck,
      title: "Super Admin",
      text: "Clientes, tags NFC e moderação.",
    },
  ];
  return (
    <main className="relative min-h-dvh overflow-hidden">
      <img
        src="/images/hero.jpg"
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-40"
      />
      <div className="absolute inset-0 bg-hero-scrim" />
      <div className="relative mx-auto flex min-h-dvh max-w-3xl flex-col justify-end px-6 pb-16 pt-24">
        <p className="text-xs uppercase tracking-[0.3em] text-gold">Bupin</p>
        <h1 className="mt-4 text-5xl leading-[1.05] sm:text-7xl">O cardápio que se assiste.</h1>
        <p className="mt-4 max-w-md text-muted-foreground">
          Encoste o celular na mesa: Wi-Fi, avaliação no Google e um feed vertical de pratos — com
          métricas de atenção para o dono.
        </p>
        <div className="mt-10 grid gap-3 sm:grid-cols-3">
          {items.map((i) => (
            <Link
              key={i.title}
              to={i.to}
              params={("params" in i ? i.params : {}) as { tag: string }}
              className="glass group rounded-2xl p-5 transition hover:bg-accent"
            >
              <i.icon className="h-5 w-5 text-gold" />
              <p className="mt-4 font-semibold">{i.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{i.text}</p>
              <ArrowRight className="mt-4 h-4 w-4 transition group-hover:translate-x-1" />
            </Link>
          ))}
        </div>
        <p className="mt-6 text-xs text-muted-foreground">
          A primeira conta criada vira Super Admin e pode cadastrar o primeiro cliente.
        </p>
      </div>
    </main>
  );
}
