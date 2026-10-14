import { cacheLife, cacheTag } from "next/cache";
import { getHubClient } from "@mypet/core/supabase";

// Lista curada dos "campeões de vendas" mostrados em /campeoes, na ordem do
// ranking. A base do hub não expõe volume de venda para a chave anon, então a
// lista é mantida à mão pelo SKU (products.reference). Para trocar um produto,
// troque o SKU aqui; item sem foto ou fora do canal some da página sozinho.
export const CHAMPIONS: readonly { sku: string; group: string }[] = [
  { sku: "16352", group: "Banho e tosa" },
  { sku: "17394", group: "Banho e tosa" },
  { sku: "22456", group: "Petiscos" },
  { sku: "20938K", group: "Higiene" },
  { sku: "903K", group: "Gatos" },
  { sku: "4647", group: "Banho e tosa" },
  { sku: "18211K", group: "Petiscos" },
  { sku: "21873K", group: "Antipulgas" },
  { sku: "414", group: "Banho e tosa" },
  { sku: "24050", group: "Gatos" },
  { sku: "L01", group: "Acessórios" },
  { sku: "22778", group: "Brinquedos" },
];

export type Champion = {
  id: string;
  sku: string;
  name: string;
  brand: string | null;
  img: string;
  group: string;
};

type Row = {
  id: string;
  name: string;
  reference: string | null;
  brand: string | null;
  product_assets: { url: string; type: string }[] | null;
};

/** "PERFUME PET LIFE ALEGRIA - 1 LITRO" -> "Perfume Pet Life Alegria - 1 Litro" */
export function displayName(name: string): string {
  return name.toLowerCase().replace(/(^|[\s(/-])([a-zà-ú])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

/** Ordena as linhas do banco pelo ranking curado e descarta as sem foto. */
export function rankChampions(rows: readonly Row[]): Champion[] {
  const bySku = new Map<string, Row>();
  for (const row of rows) {
    if (row.reference && !bySku.has(row.reference)) bySku.set(row.reference, row);
  }
  const ranked: Champion[] = [];
  for (const { sku, group } of CHAMPIONS) {
    const row = bySku.get(sku);
    const img = row?.product_assets?.find((a) => a.type === "main_image")?.url;
    if (!row || !img) continue;
    ranked.push({ id: row.id, sku, name: row.name, brand: row.brand, img, group });
  }
  return ranked;
}

export async function getChampions(channel: string): Promise<Champion[]> {
  "use cache";
  cacheLife("days");
  cacheTag("catalog");

  const supabase = getHubClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, name, reference, brand, product_assets(url, type), product_channel_links!inner(channel)")
    .eq("status", "active")
    .neq("product_role", "variant")
    .eq("product_channel_links.channel", channel)
    .in("reference", CHAMPIONS.map((c) => c.sku));

  if (error) {
    console.error("[campeoes] erro ao consultar produtos:", error.message);
    return [];
  }
  return rankChampions((data as Row[] | null) ?? []);
}
