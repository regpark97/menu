import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { LANGUAGE_OPTIONS, type MenuLocale } from "@/lib/menu-i18n";
import { useMenuLanguage, useMenuText } from "@/hooks/use-menu-language";

/** Seletor fixo no canto superior. O menu abre à esquerda da bolinha do garçom. */
export function LanguageSelector({
  locale,
  onChange,
}: {
  locale: MenuLocale;
  onChange: (locale: MenuLocale) => void;
}) {
  const { t, localeName } = useMenuLanguage();
  const { translating } = useMenuText();
  const [open, setOpen] = useState(false);
  const [top, setTop] = useState(16);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selected =
    LANGUAGE_OPTIONS.find((option) => option.locale === locale) ?? LANGUAGE_OPTIONS[0]!;

  useEffect(() => {
    if (!open) return;
    function closeOutside(event: PointerEvent) {
      const target = event.target;
      if (
        target instanceof Node &&
        !menuRef.current?.contains(target) &&
        !triggerRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    }
    function closeEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, [open]);

  return (
    <div className="fixed right-4 top-4 z-50">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setTop(Math.max(16, triggerRef.current?.getBoundingClientRect().top ?? 16));
          setOpen((value) => !value);
        }}
        aria-label={`${t("language")}: ${localeName}`}
        title={`${t("language")}: ${localeName}`}
        aria-haspopup="menu"
        aria-expanded={open}
        className="glass flex h-9 items-center gap-1.5 rounded-full px-2.5 text-sm font-medium shadow-lg transition active:scale-95"
      >
        <span className="text-lg leading-none" aria-hidden="true">
          {selected.flag}
        </span>
        {translating ? (
          <Loader2 className="h-3 w-3 animate-spin" aria-label={t("translating")} />
        ) : (
          <ChevronDown className="h-3 w-3" aria-hidden="true" />
        )}
      </button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={t("language")}
          className="absolute overflow-y-auto rounded-2xl border border-glass-border bg-card p-1.5 text-foreground shadow-2xl"
          style={{
            position: "fixed",
            top,
            right: "5.5rem",
            width: "min(11rem, calc(100vw - 7rem))",
            maxHeight: "calc(100dvh - 104px)",
          }}
        >
          {LANGUAGE_OPTIONS.map((option) => (
            <button
              key={option.locale}
              type="button"
              role="menuitemradio"
              aria-checked={option.locale === locale}
              onClick={() => {
                onChange(option.locale);
                setOpen(false);
              }}
              className="flex min-h-10 w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm transition-colors hover:bg-secondary active:bg-secondary"
            >
              <span className="text-lg leading-none" aria-hidden="true">
                {option.flag}
              </span>
              <span className="min-w-0 flex-1">{option.name}</span>
              {option.locale === locale && <Check className="h-4 w-4 shrink-0 text-gold" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
