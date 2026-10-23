export function formatMoney(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Currency mask: keeps digits only and returns cents. */
export function parseMoneyInput(raw: string): number {
  const digits = raw.replace(/\D/g, "").slice(0, 9);
  return digits ? parseInt(digits, 10) : 0;
}

export const DESCRIPTION_LIMIT = 180;

/** Attention window filter: drops accidental scrolls and forgotten phones. */
export function isValidAttention(ms: number) {
  return ms >= 400 && ms <= 120_000;
}

export function resolveMedia(url: string | null | undefined) {
  return url || "/images/hero.jpg";
}

export type ModifierGroup = { group: string; options: { name: string; price_cents: number }[] };
