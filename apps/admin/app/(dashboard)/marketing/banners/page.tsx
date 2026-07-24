import { getCategories } from "@mypet/core/catalog";
import { buildCategoryTree } from "@mypet/core/catalog-utils";
import { requireAdminSession } from "@/lib/auth";
import { flattenForSelect } from "@/lib/categories";
import BannersPageClient from "./banners-client";

export default async function BannersPageData() {
  const { supabase } = await requireAdminSession();
  const { data } = await supabase
    .from("banners")
    .select("id, type, channel, category_id, image_url, link_url, title, active")
    .order("created_at", { ascending: false });

  const categories = await getCategories();
  const tree = buildCategoryTree(categories);
  const categoryOptions = flattenForSelect(tree);

  return <BannersPageClient banners={data ?? []} categoryOptions={categoryOptions} />;
}
