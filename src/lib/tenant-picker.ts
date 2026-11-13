export type TenantPickerItem = {
  id: string;
  name: string;
  slug: string;
};

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

/** Filtro local da lista de clientes: aceita nome, slug, caixa alta e acentos.
 *  Nunca escolhe um cliente implicitamente quando o resultado é único. */
export function filterTenantsByQuery<T extends TenantPickerItem>(list: T[], query: string): T[] {
  const q = normalizeSearch(query.trim());
  if (!q) return list;
  return list.filter(
    (tenant) =>
      normalizeSearch(tenant.name).includes(q) || normalizeSearch(tenant.slug).includes(q),
  );
}
