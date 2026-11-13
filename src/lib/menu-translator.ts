import { type MenuLocale } from "@/lib/menu-i18n";

const STORE_KEY = "bupin-menu-mt-v1";
const memory = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();

type RawTranslation = {
  responseData?: { translatedText?: string };
  quotaFinished?: boolean;
  responseStatus?: number;
};

function readCache(locale: MenuLocale, source: string): string | undefined {
  if (locale === "pt-BR") return source;
  const key = `${locale}:${source.trim()}`;
  const cached = memory.get(key);
  if (cached) return cached;
  try {
    const store = JSON.parse(localStorage.getItem(STORE_KEY) ?? "{}") as Record<string, string>;
    const result = Object.hasOwn(store, key) ? store[key] : undefined;
    if (result) memory.set(key, result);
    return result;
  } catch {
    return undefined;
  }
}

function saveCache(locale: MenuLocale, source: string, translated: string) {
  if (locale === "pt-BR") return;
  const key = `${locale}:${source.trim()}`;
  memory.set(key, translated);
  try {
    const store = JSON.parse(localStorage.getItem(STORE_KEY) ?? "{}") as Record<string, string>;
    store[key] = translated;
    const keys = Object.keys(store);
    if (keys.length > 400) delete store[keys[0]!];
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    // Sem persistência (modo privado/quota cheia), cache em memória ainda funciona.
  }
}

export function cachedTranslation(locale: MenuLocale, source: string): string | undefined {
  return readCache(locale, source);
}

/** MyMemory expõe uma API pública sem chave. Em falha ou limite, conserva o original. */
async function translateText(
  source: string,
  locale: MenuLocale,
  signal?: AbortSignal,
): Promise<string> {
  if (locale === "pt-BR" || !source.trim()) return source;
  const key = `${locale}:${source.trim()}`;
  const cached = readCache(locale, source);
  if (cached) return cached;
  let pending = inflight.get(key);
  if (!pending) {
    pending = (async () => {
      const query = new URLSearchParams({ q: source.trim(), langpair: `pt|${locale}` });
      try {
        const response = await fetch(`https://api.mymemory.translated.net/get?${query}`, {
          signal: signal ?? null,
        });
        if (!response.ok) return source;
        const data = (await response.json()) as RawTranslation;
        if (data.quotaFinished || (data.responseStatus != null && data.responseStatus !== 200))
          return source;
        const translated = data.responseData?.translatedText?.trim();
        if (!translated) return source;
        saveCache(locale, source, translated);
        return translated;
      } catch (error) {
        console.error("TRANSLATE_WORKER_ERROR", locale, source, error);
        return source;
      }
    })().finally(() => inflight.delete(key));
    inflight.set(key, pending);
  }
  return pending;
}

type Translatable = { name: string; description?: string | null; modifiers?: unknown };

export function collectMenuTexts(categories: { name: string }[], products: Translatable[]) {
  const texts = new Set<string>();
  for (const category of categories) if (category.name.trim()) texts.add(category.name.trim());
  for (const product of products) {
    if (product.name.trim()) texts.add(product.name.trim());
    if (product.description?.trim()) texts.add(product.description.trim());
    const groups = Array.isArray(product.modifiers)
      ? (product.modifiers as { group?: string; options?: { name?: string }[] }[])
      : [];
    for (const group of groups) {
      if (typeof group.group === "string" && group.group.trim()) texts.add(group.group.trim());
      for (const option of group.options ?? []) {
        if (option.name?.trim()) texts.add(option.name.trim());
      }
    }
  }
  return [...texts];
}

/** Carrega poucos textos por vez, cancela versões antigas e nunca mistura idiomas. */
export function translationWorker(
  texts: string[],
  locale: MenuLocale,
  apply: (text: string, translated: string) => void,
  signal?: AbortSignal,
) {
  if (locale === "pt-BR") return Promise.resolve();
  let index = 0;
  const worker = async () => {
    while (index < texts.length) {
      if (signal?.aborted) return;
      const text = texts[index++]!;
      const cached = readCache(locale, text);
      const result = cached ?? (await translateText(text, locale, signal));
      apply(text, result);
    }
  };
  return Promise.all(Array.from({ length: Math.min(3, texts.length) }, () => worker()));
}
