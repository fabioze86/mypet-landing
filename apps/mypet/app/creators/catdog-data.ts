import { cacheLife, cacheTag } from "next/cache";
import { getHubClient } from "@mypet/core/supabase";

// Portfólio da marca própria Cat Dog mostrado em /creators. Vem direto do
// catálogo (marca "CAT DOG…" no canal), agrupado em linhas pela categoria do
// produto, então produto novo da marca entra na página sozinho.

export type CatDogProduct = {
  id: string;
  name: string;
  img: string;
};

export type CatDogLine = {
  id: string;
  title: string;
  pitch: string;
  products: CatDogProduct[];
};

// Ordem das linhas na página. `categories` casa com categories.name.
const LINES: readonly { id: string; title: string; pitch: string; categories: readonly string[] }[] = [
  {
    id: "banho",
    title: "Banho em casa",
    pitch: "Shampoos, condicionadores, sabonetes e colônias para o banho do dia a dia.",
    categories: ["Shampoos e Condicionadores", "Sabonetes", "Colônias e Perfumes", "Lenço Umedecido"],
  },
  {
    id: "cuidados",
    title: "Cuidados e limpeza",
    pitch: "Banho seco, talcos, máscaras de hidratação, limpa patas, orelha e lágrima.",
    categories: ["Cuidados e Limpeza", "Higiene"],
  },
  {
    id: "bucal",
    title: "Higiene bucal",
    pitch: "Cremes dentais em vários sabores, dedeiras e spray para hálito.",
    categories: ["Higiene Bucal"],
  },
  {
    id: "educadores",
    title: "Educadores e limpeza do rosto",
    pitch: "Educadores sanitários Sim e Não e limpadores para carinha, olhos e orelhas.",
    categories: ["Educadores Sanitários"],
  },
  {
    id: "gatos",
    title: "Para gatos",
    pitch: "Graminha e catnip: rende vídeo de reação garantido.",
    categories: ["Brinquedos", "Petiscos"],
  },
  {
    id: "profissional",
    title: "Linha profissional",
    pitch: "Galões de 5 litros e itens para máquina. Para quem fala com banho e tosa.",
    categories: ["Shampoos Profissionais (PRO)", "Equipamentos e Acessórios"],
  },
];

type Row = {
  id: string;
  name: string;
  categories: { name: string } | null;
  product_assets: { url: string; type: string }[] | null;
};

/** Agrupa as linhas do banco nas linhas da página; sem foto ou sem linha, fica de fora. */
export function groupCatDogLines(rows: readonly Row[]): CatDogLine[] {
  const byCategory = new Map<string, string>();
  for (const line of LINES) for (const c of line.categories) byCategory.set(c, line.id);

  const products = new Map<string, CatDogProduct[]>();
  for (const row of rows) {
    const lineId = row.categories ? byCategory.get(row.categories.name) : undefined;
    const img = row.product_assets?.find((a) => a.type === "main_image")?.url;
    if (!lineId || !img) continue;
    const list = products.get(lineId) ?? [];
    list.push({ id: row.id, name: row.name, img });
    products.set(lineId, list);
  }

  return LINES.flatMap(({ id, title, pitch }) => {
    const list = products.get(id);
    if (!list?.length) return [];
    return [{ id, title, pitch, products: [...list].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")) }];
  });
}

export async function getCatDogLines(channel: string): Promise<CatDogLine[]> {
  "use cache";
  cacheLife("days");
  cacheTag("catalog");

  const supabase = getHubClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, name, categories(name), product_assets(url, type), product_channel_links!inner(channel)")
    .eq("status", "active")
    .neq("product_role", "variant")
    .ilike("brand", "CAT DOG%")
    .eq("product_channel_links.channel", channel)
    .limit(500);

  if (error) {
    console.error("[creators] erro ao consultar produtos Cat Dog:", error.message);
    return [];
  }
  return groupCatDogLines((data as unknown as Row[] | null) ?? []);
}
