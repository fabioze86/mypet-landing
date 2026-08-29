import { cacheLife, cacheTag } from "next/cache";
import { getHubClient } from "@mypet/core/supabase";

type Row = {
  category_id: string | null;
  product_assets: { url: string; type: string }[] | null;
};

/**
 * First real product image per category, for the public landing tiles.
 * Cached like the catalog. Never returns the placeholder image — a category
 * with no usable photo is simply absent from the map (the tile falls back to
 * a tinted block).
 */
export async function getCategoryThumbs(channel: string): Promise<Record<string, string>> {
  "use cache";
  cacheLife("days");
  cacheTag("catalog");

  const supabase = getHubClient();
  const { data, error } = await supabase
    .from("products")
    .select("category_id, product_assets(url, type), product_channel_links!inner(channel)")
    .eq("product_channel_links.channel", channel)
    .not("category_id", "is", null)
    .limit(2000);

  if (error) {
    console.error("[landing] erro ao consultar imagens de categoria:", error.message);
    return {};
  }

  const thumbs: Record<string, string> = {};
  for (const row of (data as Row[] | null) ?? []) {
    const id = row.category_id;
    if (!id || thumbs[id]) continue;
    const asset = row.product_assets?.find((a) => a.type === "main_image");
    if (asset?.url) thumbs[id] = asset.url;
  }
  return thumbs;
}
