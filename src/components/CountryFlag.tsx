import type { MenuLocale } from "@/lib/menu-i18n";

/**
 * Bandeiras em SVG: emojis de bandeira viram siglas ("BR", "EN") no Windows.
 * aria-hidden: o texto do botão/opção já identifica o idioma para leitores.
 */
export function CountryFlag({ locale }: { locale: MenuLocale }) {
  const common = {
    className: "h-4 w-6 shrink-0 rounded-[3px] ring-1 ring-black/10",
    viewBox: "0 0 24 16",
    "aria-hidden": true,
    focusable: "false",
  } as const;

  switch (locale) {
    case "pt-BR":
      return (
        <svg {...common}>
          <rect width="24" height="16" fill="#009c3b" />
          <polygon points="12,2 22,8 12,14 2,8" fill="#ffdf00" />
          <circle cx="12" cy="8" r="3.1" fill="#002776" />
          <path d="M9.2 7.1 Q 11.9 6 14.9 8.4" fill="none" stroke="#fff" strokeWidth="0.55" />
        </svg>
      );
    case "en":
      return (
        <svg {...common}>
          <rect width="24" height="16" fill="#012169" />
          <path d="M0 0 24 16 M24 0 0 16" stroke="#fff" strokeWidth="3" />
          <path d="M0 0 24 16 M24 0 0 16" stroke="#c8102e" strokeWidth="1.4" />
          <path d="M12 0V16 M0 8H24" stroke="#fff" strokeWidth="5" />
          <path d="M12 0V16 M0 8H24" stroke="#c8102e" strokeWidth="3" />
        </svg>
      );
    case "fr":
      return (
        <svg {...common}>
          <rect width="24" height="16" fill="#fff" />
          <rect width="8" height="16" fill="#002654" />
          <rect x="16" width="8" height="16" fill="#ce1126" />
        </svg>
      );
    case "it":
      return (
        <svg {...common}>
          <rect width="24" height="16" fill="#fff" />
          <rect width="8" height="16" fill="#009246" />
          <rect x="16" width="8" height="16" fill="#ce2b37" />
        </svg>
      );
    case "es":
      return (
        <svg {...common}>
          <rect width="24" height="16" fill="#aa151b" />
          <rect y="4" width="24" height="8" fill="#f1bf00" />
        </svg>
      );
    case "ru":
      return (
        <svg {...common}>
          <rect width="24" height="16" fill="#fff" />
          <rect y="5.33" width="24" height="5.34" fill="#0039a6" />
          <rect y="10.67" width="24" height="5.33" fill="#d52b1e" />
        </svg>
      );
    case "zh-CN":
      return (
        <svg {...common}>
          <rect width="24" height="16" fill="#de2910" />
          <path d={STAR} transform="translate(5 5) scale(1.9)" fill="#ffde00" />
          <path d={STAR} transform="translate(9 2.4) rotate(24) scale(0.65)" fill="#ffde00" />
          <path d={STAR} transform="translate(10.6 4.7) rotate(45) scale(0.65)" fill="#ffde00" />
          <path d={STAR} transform="translate(10.6 7.6) scale(0.65)" fill="#ffde00" />
          <path d={STAR} transform="translate(9 10) rotate(-24) scale(0.65)" fill="#ffde00" />
        </svg>
      );
    default:
      return null;
  }
}

const STAR =
  "M0 -1 L0.2245 -0.309 L0.951 -0.309 L0.363 0.118 L0.588 0.809 L0 0.4 L-0.588 0.809 L-0.363 0.118 L-0.951 -0.309 L-0.2245 -0.309 Z";
