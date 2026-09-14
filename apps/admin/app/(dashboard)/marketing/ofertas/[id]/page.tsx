import { notFound } from "next/navigation";
import { requireAdminSession } from "@/lib/auth";
import ItensPageClient from "./itens-client";

export default async function OfertaDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireAdminSession();

  const { data: campaign } = await supabase
    .from("offer_campaigns")
    .select("id, slug, title, channel")
    .eq("id", id)
    .single();
  if (!campaign) notFound();

  const { data: items } = await supabase
    .from("offer_campaign_items")
    .select("id, product_id, promotional_price, min_quantity, sort_order, products(name, reference)")
    .eq("campaign_id", id)
    .order("sort_order", { ascending: true });

  const normalizedItems = (items ?? []).map((item) => ({
    ...item,
    products: Array.isArray(item.products) ? (item.products[0] ?? null) : item.products,
  }));

  return <ItensPageClient campaign={campaign} items={normalizedItems} />;
}
