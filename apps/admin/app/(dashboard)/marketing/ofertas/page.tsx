import { requireAdminSession } from "@/lib/auth";
import OfertasPageClient from "./ofertas-client";

export default async function OfertasPageData() {
  const { supabase } = await requireAdminSession();
  const { data } = await supabase
    .from("offer_campaigns")
    .select("id, channel, slug, title, active, starts_at, ends_at, hero_priority, flash_offer")
    .order("created_at", { ascending: false });

  return <OfertasPageClient campaigns={data ?? []} />;
}
