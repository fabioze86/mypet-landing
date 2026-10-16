// Nomes do catálogo vêm em caixa alta; as landings mostram em título.
/** "PERFUME PET LIFE ALEGRIA - 1 LITRO" -> "Perfume Pet Life Alegria - 1 Litro" */
export function displayName(name: string): string {
  return name.toLowerCase().replace(/(^|[\s(/-])([a-zà-ú])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}
