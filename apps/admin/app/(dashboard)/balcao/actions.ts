"use server";

import { z } from "zod";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/auth";
import { parseTiersInput } from "@/lib/balcao";

const CHANNEL = "mypetbrasil";

const CreateRuleSchema = z
  .object({
    scope: z.enum(["categoria", "sku"]),
    categoryId: z.string().uuid().nullable(),
    productReference: z.string().min(1).nullable(),
    startsAt: z.string().nullable(),
    endsAt: z.string().nullable(),
  })
  .refine(
    (d) =>
      (d.scope === "categoria" && d.categoryId && !d.productReference) ||
      (d.scope === "sku" && d.productReference && !d.categoryId),
    { message: "Escopo inconsistente com os campos preenchidos." },
  );

export async function createRule(formData: FormData): Promise<void> {
  const { supabase } = await requireAdminSession();

  const scope = String(formData.get("scope") ?? "");
  const parsed = CreateRuleSchema.safeParse({
    scope,
    categoryId: formData.get("categoryId") ? String(formData.get("categoryId")) : null,
    productReference: formData.get("productReference")
      ? String(formData.get("productReference")).trim()
      : null,
    startsAt: formData.get("startsAt") ? String(formData.get("startsAt")) : null,
    endsAt: formData.get("endsAt") ? String(formData.get("endsAt")) : null,
  });
  if (!parsed.success) {
    redirect("/balcao?error=dados_invalidos");
  }

  let rawTiers: { minQty: unknown; discountPct: unknown }[] = [];
  try {
    rawTiers = JSON.parse(String(formData.get("tiers") ?? "[]"));
  } catch {
    redirect("/balcao?error=faixas_invalidas");
  }
  if (rawTiers.length === 0) {
    redirect("/balcao?error=sem_faixas");
  }
  const tiersResult = parseTiersInput(rawTiers);
  if ("error" in tiersResult) {
    redirect("/balcao?error=faixas_invalidas");
  }

  const { data: rule, error: ruleError } = await supabase
    .from("balcao_rules")
    .insert({
      channel: CHANNEL,
      scope: parsed.data.scope,
      category_id: parsed.data.categoryId,
      product_reference: parsed.data.productReference,
      excluded: false,
      active: true,
      starts_at: parsed.data.startsAt || null,
      ends_at: parsed.data.endsAt || null,
    })
    .select("id")
    .single();

  if (ruleError || !rule) {
    console.error("[admin/balcao] erro ao criar regra:", ruleError?.message);
    redirect("/balcao?error=falha_ao_salvar");
  }

  const { error: tiersError } = await supabase.from("balcao_rule_tiers").insert(
    tiersResult.tiers.map((t) => ({
      rule_id: rule.id,
      min_qty: t.minQty,
      discount_pct: t.discountPct,
    })),
  );
  if (tiersError) {
    console.error("[admin/balcao] erro ao gravar faixas:", tiersError.message);
    redirect("/balcao?error=falha_ao_salvar");
  }

  updateTag("balcao");
  redirect("/balcao");
}

export async function deleteRule(formData: FormData): Promise<void> {
  const { supabase } = await requireAdminSession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const { error } = await supabase.from("balcao_rules").delete().eq("id", id);
  if (error) {
    console.error("[admin/balcao] erro ao excluir regra:", error.message);
    return;
  }
  updateTag("balcao");
  redirect("/balcao");
}

const ExcludeSchema = z.object({ productReference: z.string().min(1) });

export async function setExcluded(formData: FormData): Promise<void> {
  const { supabase } = await requireAdminSession();
  const parsed = ExcludeSchema.safeParse({
    productReference: String(formData.get("productReference") ?? "").trim(),
  });
  if (!parsed.success) redirect("/balcao?error=dados_invalidos");

  const { error } = await supabase.from("balcao_rules").upsert(
    {
      channel: CHANNEL,
      scope: "sku",
      category_id: null,
      product_reference: parsed.data.productReference,
      excluded: true,
      active: true,
    },
    { onConflict: "channel,scope,category_id,product_reference" },
  );
  if (error) {
    console.error("[admin/balcao] erro ao excluir SKU:", error.message);
    redirect("/balcao?error=falha_ao_salvar");
  }
  updateTag("balcao");
  redirect("/balcao");
}

const UpdateRuleSchema = z.object({
  active: z.boolean(),
  startsAt: z.string().nullable(),
  endsAt: z.string().nullable(),
});

export async function updateRule(id: string, formData: FormData): Promise<void> {
  const { supabase } = await requireAdminSession();

  const parsed = UpdateRuleSchema.safeParse({
    active: formData.get("active") === "on",
    startsAt: formData.get("startsAt") ? String(formData.get("startsAt")) : null,
    endsAt: formData.get("endsAt") ? String(formData.get("endsAt")) : null,
  });
  if (!parsed.success) redirect(`/balcao/${id}?error=dados_invalidos`);

  let rawTiers: { minQty: unknown; discountPct: unknown }[] = [];
  try {
    rawTiers = JSON.parse(String(formData.get("tiers") ?? "[]"));
  } catch {
    redirect(`/balcao/${id}?error=faixas_invalidas`);
  }
  const tiersResult = parseTiersInput(rawTiers);
  if ("error" in tiersResult) redirect(`/balcao/${id}?error=faixas_invalidas`);
  if (tiersResult.tiers.length === 0) redirect(`/balcao/${id}?error=sem_faixas`);

  const { error: updError } = await supabase
    .from("balcao_rules")
    .update({
      active: parsed.data.active,
      starts_at: parsed.data.startsAt || null,
      ends_at: parsed.data.endsAt || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (updError) {
    console.error("[admin/balcao] erro ao atualizar regra:", updError.message);
    redirect(`/balcao/${id}?error=falha_ao_salvar`);
  }

  await supabase.from("balcao_rule_tiers").delete().eq("rule_id", id);
  const { error: tiersError } = await supabase.from("balcao_rule_tiers").insert(
    tiersResult.tiers.map((t) => ({ rule_id: id, min_qty: t.minQty, discount_pct: t.discountPct })),
  );
  if (tiersError) {
    console.error("[admin/balcao] erro ao regravar faixas:", tiersError.message);
    redirect(`/balcao/${id}?error=falha_ao_salvar`);
  }

  updateTag("balcao");
  redirect("/balcao");
}
