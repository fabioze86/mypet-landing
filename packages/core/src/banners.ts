import { cacheLife, cacheTag } from "next/cache";
import { getHubClient } from "./supabase";
import type { Channel } from "./channels";

export type BannerType = "principal" | "mini" | "categoria";

export type Banner = {
  id: string;
  type: BannerType;
  imageUrl: string;
  linkUrl: string | null;
  title: string | null;
  sortOrder: number;
};

type RawBanner = {
  id: string;
  type: BannerType;
  image_url: string;
  link_url: string | null;
  title: string | null;
  sort_order: number;
};

function mapBanner(row: RawBanner): Banner {
  return {
    id: row.id,
    type: row.type,
    imageUrl: row.image_url,
    linkUrl: row.link_url,
    title: row.title,
    sortOrder: row.sort_order,
  };
}

export async function getBanners(
  channel: Channel,
  type: BannerType,
  categoryId?: string,
): Promise<Banner[]> {
  "use cache";
  cacheLife("days");
  cacheTag("banners");

  if (type === "categoria" && !categoryId) return [];

  const supabase = getHubClient();
  let query = supabase
    .from("banners")
    .select("id, type, image_url, link_url, title, sort_order")
    .eq("channel", channel)
    .eq("type", type)
    .order("sort_order", { ascending: true });

  if (type === "categoria" && categoryId) {
    query = query.eq("category_id", categoryId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[banners] erro ao consultar banners:", error.message);
    return [];
  }

  return ((data as RawBanner[]) ?? []).map(mapBanner);
}
