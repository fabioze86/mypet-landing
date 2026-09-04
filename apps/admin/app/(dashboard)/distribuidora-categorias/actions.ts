"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth";

const Channel = "ffa_fabrica";
const Assignment = z.object({
  productId: z.string().uuid(),
  categoryId: z.string().uuid().nullable(),
});

export async function assignDistribuidoraCategory(formData: FormData): Promise<void> {
  const { supabase } = await requireAdminSession();
  const parsed = Assignment.safeParse({
    productId: formData.get("productId"),
    categoryId: formData.get("categoryId") || null,
  });
  if (!parsed.success) throw new Error("Dados de categoria invÃ¡lidos.");

  const { productId, categoryId } = parsed.data;
  const { data: link } = await supabase
    .from("product_channel_links")
    .select("product_id")
    .eq("product_id", productId)
    .eq("channel", Channel)
    .maybeSingle();
  if (!link) throw new Error("Produto nÃ£o pertence Ã  Distribuidora.");

  if (!categoryId) {
    const { error } = await supabase
      .from("product_channel_categories")
      .delete()
      .eq("product_id", productId)
      .eq("channel", Channel);
    if (error) throw new Error("NÃ£o foi possÃ­vel remover a categoria.");
    updateTag("catalog");
    return;
  }

  const { data: category } = await supabase
    .from("channel_categories")
    .select("id")
    .eq("id", categoryId)
    .eq("channel", Channel)
    .maybeSingle();
  if (!category) throw new Error("Categoria invÃ¡lida para a Distribuidora.");

  const { error } = await supabase.from("product_channel_categories").upsert(
    { product_id: productId, channel: Channel, category_id: categoryId, updated_at: new Date().toISOString() },
    { onConflict: "product_id,channel" },
  );
  if (error) throw new Error("NÃ£o foi possÃ­vel salvar a categoria.");
  updateTag("catalog");
}
