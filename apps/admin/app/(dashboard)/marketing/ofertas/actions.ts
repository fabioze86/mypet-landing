"use server";

import { z } from "zod";
import { updateTag } from "next/cache";
import { requireAdminSession } from "@/lib/auth";
import { localDateTimeToIsoUtc } from "@mypet/core/datetime";

const CampaignSchema = z.object({
  channel: z.enum(["ffa_fabrica"]),
  slug: z
    .string()
    .trim()
    .min(1, "Informe o slug da campanha.")
    .regex(/^[a-z0-9-]+$/, "O slug só pode ter letras minúsculas, números e hífen."),
  title: z.string().trim().nullable(),
  subtitle: z.string().trim().nullable(),
  badge: z.string().trim().nullable(),
  couponCode: z.string().trim().nullable(),
  couponDescription: z.string().trim().nullable(),
  couponDiscountPct: z.coerce.number().min(0).max(100).nullable(),
  freightMessage: z.string().trim().nullable(),
  primaryCtaLabel: z.string().trim().nullable(),
  secondaryCtaLabel: z.string().trim().nullable(),
  heroPriority: z.coerce.number().int().default(0),
  flashOffer: z.boolean().default(false),
  active: z.boolean().default(false),
  startsAt: z.string().trim().nullable(),
  endsAt: z.string().trim().nullable(),
});

// Mesmos campos editáveis de CampaignSchema, exceto `channel`/`slug`: depois
// de criada, a campanha mantém canal e slug fixos (o slug já pode estar
// linkado em posts/anúncios; trocá-lo quebraria URLs publicadas). O formulário
// de edição exibe esses dois campos como somente leitura e não os envia.
const UpdateCampaignSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().nullable(),
  subtitle: z.string().trim().nullable(),
  badge: z.string().trim().nullable(),
  couponCode: z.string().trim().nullable(),
  couponDescription: z.string().trim().nullable(),
  couponDiscountPct: z.coerce.number().min(0).max(100).nullable(),
  freightMessage: z.string().trim().nullable(),
  primaryCtaLabel: z.string().trim().nullable(),
  secondaryCtaLabel: z.string().trim().nullable(),
  heroPriority: z.coerce.number().int().default(0),
  flashOffer: z.boolean().default(false),
  active: z.boolean().default(false),
  startsAt: z.string().trim().nullable(),
  endsAt: z.string().trim().nullable(),
});

const DeleteCampaignSchema = z.object({ id: z.string().uuid() });
const ToggleCampaignActiveSchema = z.object({
  id: z.string().uuid(),
  active: z.enum(["true", "false"]),
});

export type CampaignFormState = { error?: string } | undefined;

function emptyToNull(value: FormDataEntryValue | null): string | null {
  const s = value ? String(value).trim() : "";
  return s.length > 0 ? s : null;
}

export async function createCampaign(_state: CampaignFormState, formData: FormData): Promise<CampaignFormState> {
  const { supabase } = await requireAdminSession();

  const parsed = CampaignSchema.safeParse({
    channel: formData.get("channel"),
    slug: formData.get("slug"),
    title: emptyToNull(formData.get("title")),
    subtitle: emptyToNull(formData.get("subtitle")),
    badge: emptyToNull(formData.get("badge")),
    couponCode: emptyToNull(formData.get("couponCode")),
    couponDescription: emptyToNull(formData.get("couponDescription")),
    couponDiscountPct: formData.get("couponDiscountPct") ? formData.get("couponDiscountPct") : null,
    freightMessage: emptyToNull(formData.get("freightMessage")),
    primaryCtaLabel: emptyToNull(formData.get("primaryCtaLabel")),
    secondaryCtaLabel: emptyToNull(formData.get("secondaryCtaLabel")),
    heroPriority: formData.get("heroPriority") ?? 0,
    flashOffer: formData.get("flashOffer") === "on",
    active: formData.get("active") === "on",
    startsAt: emptyToNull(formData.get("startsAt")),
    endsAt: emptyToNull(formData.get("endsAt")),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { error } = await supabase.from("offer_campaigns").insert({
    channel: parsed.data.channel,
    slug: parsed.data.slug,
    title: parsed.data.title,
    subtitle: parsed.data.subtitle,
    badge: parsed.data.badge,
    coupon_code: parsed.data.couponCode,
    coupon_description: parsed.data.couponDescription,
    coupon_discount_pct: parsed.data.couponDiscountPct,
    freight_message: parsed.data.freightMessage,
    primary_cta_label: parsed.data.primaryCtaLabel,
    secondary_cta_label: parsed.data.secondaryCtaLabel,
    hero_priority: parsed.data.heroPriority,
    flash_offer: parsed.data.flashOffer,
    active: parsed.data.active,
    // startsAt/endsAt vêm de <input type="datetime-local"> (sem fuso) — o
    // operador preenche no horário de Brasília, fixo em UTC-3 (sem horário
    // de verão desde 2019). Sem essa conversão, o Postgres interpretaria o
    // valor cru como UTC e a campanha entraria/sairia do ar 3h adiantada.
    starts_at: localDateTimeToIsoUtc(parsed.data.startsAt ?? ""),
    ends_at: localDateTimeToIsoUtc(parsed.data.endsAt ?? ""),
  });

  if (error) {
    console.error("[admin/ofertas] erro ao criar campanha:", error.message);
    if (error.code === "23505") return { error: "Já existe uma campanha com esse slug nesse canal." };
    return { error: "Não foi possível salvar a campanha." };
  }

  updateTag("offers");
  return undefined;
}

export async function updateCampaign(_state: CampaignFormState, formData: FormData): Promise<CampaignFormState> {
  const { supabase } = await requireAdminSession();

  const parsed = UpdateCampaignSchema.safeParse({
    id: formData.get("id"),
    title: emptyToNull(formData.get("title")),
    subtitle: emptyToNull(formData.get("subtitle")),
    badge: emptyToNull(formData.get("badge")),
    couponCode: emptyToNull(formData.get("couponCode")),
    couponDescription: emptyToNull(formData.get("couponDescription")),
    couponDiscountPct: formData.get("couponDiscountPct") ? formData.get("couponDiscountPct") : null,
    freightMessage: emptyToNull(formData.get("freightMessage")),
    primaryCtaLabel: emptyToNull(formData.get("primaryCtaLabel")),
    secondaryCtaLabel: emptyToNull(formData.get("secondaryCtaLabel")),
    heroPriority: formData.get("heroPriority") ?? 0,
    flashOffer: formData.get("flashOffer") === "on",
    active: formData.get("active") === "on",
    startsAt: emptyToNull(formData.get("startsAt")),
    endsAt: emptyToNull(formData.get("endsAt")),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { error } = await supabase
    .from("offer_campaigns")
    .update({
      title: parsed.data.title,
      subtitle: parsed.data.subtitle,
      badge: parsed.data.badge,
      coupon_code: parsed.data.couponCode,
      coupon_description: parsed.data.couponDescription,
      coupon_discount_pct: parsed.data.couponDiscountPct,
      freight_message: parsed.data.freightMessage,
      primary_cta_label: parsed.data.primaryCtaLabel,
      secondary_cta_label: parsed.data.secondaryCtaLabel,
      hero_priority: parsed.data.heroPriority,
      flash_offer: parsed.data.flashOffer,
      active: parsed.data.active,
      starts_at: localDateTimeToIsoUtc(parsed.data.startsAt ?? ""),
      ends_at: localDateTimeToIsoUtc(parsed.data.endsAt ?? ""),
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.id);

  if (error) {
    console.error("[admin/ofertas] erro ao atualizar campanha:", error.message);
    return { error: "Não foi possível salvar as alterações da campanha." };
  }

  updateTag("offers");
  return undefined;
}

export async function deleteCampaign(formData: FormData): Promise<void> {
  const { supabase } = await requireAdminSession();
  const parsed = DeleteCampaignSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return;

  const { error } = await supabase.from("offer_campaigns").delete().eq("id", parsed.data.id);
  if (error) {
    console.error("[admin/ofertas] erro ao excluir campanha:", error.message);
    return;
  }
  updateTag("offers");
}

export async function toggleCampaignActive(formData: FormData): Promise<void> {
  const { supabase } = await requireAdminSession();
  const parsed = ToggleCampaignActiveSchema.safeParse({
    id: formData.get("id"),
    active: formData.get("active"),
  });
  if (!parsed.success) return;

  const active = parsed.data.active === "true";
  const { error } = await supabase
    .from("offer_campaigns")
    .update({ active: !active, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.id);
  if (error) {
    console.error("[admin/ofertas] erro ao alternar campanha:", error.message);
    return;
  }
  updateTag("offers");
}

const AddItemSchema = z.object({
  campaignId: z.string().uuid(),
  productReference: z.string().trim().min(1, "Informe a referência (CPRO/SKU) do produto."),
  promotionalPrice: z.coerce.number().positive("O preço promocional precisa ser maior que zero."),
  minQuantity: z.coerce.number().int().min(1).default(1),
  sortOrder: z.coerce.number().int().default(0),
});

const UpdateItemSchema = z.object({
  id: z.string().uuid(),
  promotionalPrice: z.coerce.number().positive("O preço promocional precisa ser maior que zero."),
  minQuantity: z.coerce.number().int().min(1).default(1),
  sortOrder: z.coerce.number().int().default(0),
});

const RemoveItemSchema = z.object({ id: z.string().uuid() });

export type AddItemFormState = { error?: string } | undefined;

export async function addCampaignItem(_state: AddItemFormState, formData: FormData): Promise<AddItemFormState> {
  const { supabase } = await requireAdminSession();

  const parsed = AddItemSchema.safeParse({
    campaignId: formData.get("campaignId"),
    productReference: formData.get("productReference"),
    promotionalPrice: formData.get("promotionalPrice"),
    minQuantity: formData.get("minQuantity") || 1,
    sortOrder: formData.get("sortOrder") || 0,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { data: campaign } = await supabase
    .from("offer_campaigns")
    .select("channel")
    .eq("id", parsed.data.campaignId)
    .single();
  if (!campaign) return { error: "Campanha não encontrada." };

  const { data: product } = await supabase
    .from("products")
    .select("id, product_channel_links!inner(channel)")
    .eq("reference", parsed.data.productReference)
    .eq("product_channel_links.channel", campaign.channel)
    .maybeSingle();
  if (!product) return { error: "Produto não encontrado nesse canal (confira a referência/CPRO)." };

  const { error } = await supabase.from("offer_campaign_items").insert({
    campaign_id: parsed.data.campaignId,
    product_id: product.id,
    promotional_price: parsed.data.promotionalPrice,
    min_quantity: parsed.data.minQuantity,
    sort_order: parsed.data.sortOrder,
  });

  if (error) {
    console.error("[admin/ofertas] erro ao adicionar item:", error.message);
    if (error.code === "23505") return { error: "Esse produto já está nessa campanha." };
    return { error: "Não foi possível adicionar o item." };
  }

  updateTag("offers");
  return undefined;
}

export async function updateCampaignItem(_state: AddItemFormState, formData: FormData): Promise<AddItemFormState> {
  const { supabase } = await requireAdminSession();

  const parsed = UpdateItemSchema.safeParse({
    id: formData.get("id"),
    promotionalPrice: formData.get("promotionalPrice"),
    minQuantity: formData.get("minQuantity") || 1,
    sortOrder: formData.get("sortOrder") || 0,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { error } = await supabase
    .from("offer_campaign_items")
    .update({
      promotional_price: parsed.data.promotionalPrice,
      min_quantity: parsed.data.minQuantity,
      sort_order: parsed.data.sortOrder,
    })
    .eq("id", parsed.data.id);

  if (error) {
    console.error("[admin/ofertas] erro ao atualizar item:", error.message);
    return { error: "Não foi possível salvar as alterações do item." };
  }

  updateTag("offers");
  return undefined;
}

export async function removeCampaignItem(formData: FormData): Promise<void> {
  const { supabase } = await requireAdminSession();
  const parsed = RemoveItemSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return;

  const { error } = await supabase.from("offer_campaign_items").delete().eq("id", parsed.data.id);
  if (error) {
    console.error("[admin/ofertas] erro ao remover item:", error.message);
    return;
  }
  updateTag("offers");
}
