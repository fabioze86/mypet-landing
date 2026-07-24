"use server";

import { z } from "zod";
import { updateTag } from "next/cache";
import { requireAdminSession } from "@/lib/auth";
import { findConflictingCategoryBanner, type ExistingBanner } from "@/lib/banners";
import { uploadImageToCloudflare } from "@/lib/cloudflare-images";

const BannerSchema = z.object({
  type: z.enum(["principal", "mini", "categoria"]),
  channel: z.enum(["mypetbrasil", "distribuidora"]),
  categoryId: z.string().uuid().nullable(),
  linkUrl: z.string().nullable(),
  title: z.string().nullable(),
  sortOrder: z.coerce.number().int().default(0),
  active: z.boolean().default(true),
});

const DeleteBannerSchema = z.object({
  id: z.string().uuid(),
});

const ToggleBannerActiveSchema = z.object({
  id: z.string().uuid(),
  active: z.enum(["true", "false"]),
});

export type BannerFormState = { error?: string } | undefined;

async function resolveImageUrl(formData: FormData, existingUrl?: string): Promise<{ url: string } | { error: string }> {
  const file = formData.get("image");
  if (file instanceof File && file.size > 0) {
    return uploadImageToCloudflare(file);
  }
  if (existingUrl) return { url: existingUrl };
  return { error: "Selecione uma imagem para o banner." };
}

export async function createBanner(_state: BannerFormState, formData: FormData): Promise<BannerFormState> {
  const { supabase } = await requireAdminSession();

  const rawCategoryId = formData.get("categoryId");
  const parsed = BannerSchema.safeParse({
    type: formData.get("type"),
    channel: formData.get("channel"),
    categoryId: rawCategoryId ? String(rawCategoryId) : null,
    linkUrl: formData.get("linkUrl") || null,
    title: formData.get("title") || null,
    sortOrder: formData.get("sortOrder"),
    active: formData.get("active") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  if (parsed.data.type === "categoria" && !parsed.data.categoryId) {
    return { error: "Selecione a categoria para um banner do tipo categoria." };
  }

  const { data: existing } = await supabase
    .from("banners")
    .select("id, type, channel, category_id, active");

  const conflict = findConflictingCategoryBanner((existing ?? []) as ExistingBanner[], {
    type: parsed.data.type,
    channel: parsed.data.channel,
    category_id: parsed.data.categoryId,
  });

  if (conflict) {
    return { error: "Já existe um banner ativo para essa categoria e canal. Desative-o antes de criar outro." };
  }

  const imageResult = await resolveImageUrl(formData);
  if ("error" in imageResult) return { error: imageResult.error };

  const { error } = await supabase.from("banners").insert({
    type: parsed.data.type,
    channel: parsed.data.channel,
    category_id: parsed.data.categoryId,
    image_url: imageResult.url,
    link_url: parsed.data.linkUrl,
    title: parsed.data.title,
    sort_order: parsed.data.sortOrder,
    active: parsed.data.active,
  });

  if (error) {
    console.error("[admin/banners] erro ao criar banner:", error.message);
    return { error: "Não foi possível salvar o banner." };
  }

  updateTag("banners");
  return undefined;
}

export async function deleteBanner(formData: FormData): Promise<void> {
  const { supabase } = await requireAdminSession();
  const parsed = DeleteBannerSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return;
  const { id } = parsed.data;

  const { error } = await supabase.from("banners").delete().eq("id", id);
  if (error) {
    console.error("[admin/banners] erro ao excluir banner:", error.message);
    return;
  }

  updateTag("banners");
}

export async function toggleBannerActive(formData: FormData): Promise<void> {
  const { supabase } = await requireAdminSession();
  const parsed = ToggleBannerActiveSchema.safeParse({
    id: formData.get("id"),
    active: formData.get("active"),
  });
  if (!parsed.success) return;
  const { id } = parsed.data;
  const active = parsed.data.active === "true";

  const { error } = await supabase
    .from("banners")
    .update({ active: !active, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("[admin/banners] erro ao alternar banner:", error.message);
    return;
  }

  updateTag("banners");
}
