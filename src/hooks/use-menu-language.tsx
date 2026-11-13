/* eslint-disable react-refresh/only-export-components -- Provider e hooks compartilham o mesmo contexto. */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  LANGUAGE_OPTIONS,
  menuLocaleFor,
  uiText,
  type MenuLocale,
  type UiKey,
} from "@/lib/menu-i18n";
import { cachedTranslation, collectMenuTexts, translationWorker } from "@/lib/menu-translator";

export type TranslatableProduct = {
  name: string;
  description?: string | null;
  modifiers?: unknown;
};

type LanguageContext = {
  locale: MenuLocale;
  setLocale: (locale: MenuLocale) => void;
  t: (key: UiKey, table?: string) => string;
};

type ContentContext = {
  text: (source: string | null | undefined) => string;
  translating: boolean;
};

const Language = createContext<LanguageContext | null>(null);
const Content = createContext<ContentContext>({
  text: (source) => source ?? "",
  translating: false,
});

export function MenuLanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<MenuLocale>(() => {
    try {
      return menuLocaleFor(localStorage.getItem("bupin-menu-locale"));
    } catch {
      return "pt-BR";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("bupin-menu-locale", locale);
    } catch {
      /* armazenamento indisponível */
    }
    document.documentElement.lang = locale;
  }, [locale]);

  const t = useCallback((key: UiKey, table?: string) => uiText(locale, key, table), [locale]);
  return <Language.Provider value={{ locale, t, setLocale }}>{children}</Language.Provider>;
}

export function MenuContentProvider({
  categories,
  products,
  children,
}: {
  categories: { name: string }[];
  products: TranslatableProduct[];
  children: ReactNode;
}) {
  const { locale } = useMenuLanguage();
  const texts = useMemo(() => collectMenuTexts(categories, products), [categories, products]);
  const [bundle, setBundle] = useState<{ locale: MenuLocale; values: Record<string, string> }>({
    locale: "pt-BR",
    values: {},
  });
  const [translating, setTranslating] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    if (locale === "pt-BR") {
      setBundle({ locale, values: {} });
      setTranslating(false);
      controller.abort();
      return () => {
        active = false;
      };
    }

    const values = Object.fromEntries(
      texts.flatMap((source) => {
        const translated = cachedTranslation(locale, source);
        return translated ? [[source, translated]] : [];
      }),
    ) as Record<string, string>;
    setBundle({ locale, values });
    const missing = texts.filter((source) => !cachedTranslation(locale, source));
    setTranslating(missing.length > 0);

    void translationWorker(
      texts,
      locale,
      (source, translated) => {
        if (!active) return;
        setBundle((current) => {
          if (current.locale !== locale || current.values[source] === translated) return current;
          return { locale, values: { ...current.values, [source]: translated } };
        });
      },
      controller.signal,
    ).then(() => {
      if (active) setTranslating(false);
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, [locale, texts]);

  const text = useCallback(
    (source: string | null | undefined) => {
      if (!source || locale === "pt-BR" || bundle.locale !== locale) return source ?? "";
      return bundle.values[source] ?? source;
    },
    [locale, bundle],
  );
  return <Content.Provider value={{ text, translating }}>{children}</Content.Provider>;
}

export function useMenuLanguage() {
  const value = useContext(Language);
  if (!value) throw new Error("MenuLanguageProvider ausente");
  const localeName =
    LANGUAGE_OPTIONS.find((option) => option.locale === value.locale)?.name ?? value.locale;
  return { ...value, localeName };
}

export function useMenuText() {
  return useContext(Content);
}
