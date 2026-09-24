/**
 * Ícones válidos para categoria da central de ajuda (nomes do
 * @phosphor-icons/react, renderizados na página pública via `PaIcon`).
 *
 * Fica num arquivo próprio, fora de `actions.ts`: um módulo `"use server"`
 * só pode exportar funções async — exportar esta constante dali quebra o
 * build (`A "use server" file can only export async functions`).
 */
export const ICONES_AJUDA = [
  "Flag",
  "UserCircle",
  "Package",
  "Tag",
  "ShoppingCart",
  "CreditCard",
  "Truck",
  "Storefront",
  "ArrowsClockwise",
  "Receipt",
  "Handshake",
] as const;
