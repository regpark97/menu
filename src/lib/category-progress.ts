export type CategoryProgress = { visible: boolean; left: number; width: number };

/** Posição e fração visível da faixa horizontal de categorias (em porcentagem). */
export function categoryProgress(
  clientWidth: number,
  scrollWidth: number,
  scrollLeft: number,
): CategoryProgress {
  const maxScroll = scrollWidth - clientWidth;
  if (clientWidth <= 0 || maxScroll <= 8) return { visible: false, left: 0, width: 100 };
  const width = Math.max(12, Math.min(100, (clientWidth / scrollWidth) * 100));
  const left = Math.max(0, Math.min(100 - width, (scrollLeft / maxScroll) * (100 - width)));
  return { visible: true, left, width };
}
