"use server";

import { z } from "zod";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/auth";
import { slugify, canDeleteCategory, isDuplicateSlugError } from "@/lib/categories";

const UpsertSchema = z.object({
  name: z.string().min(1, "Informe o nome."),
  slug: z.string().min(1, "Informe o slug."),
  parentId: z.string().uuid().nullable(),
  sortOrder: z.coerce.number().int().default(0),
});

function levelFromParent(parentLevel: number | null): number {
  return (parentLevel ?? 0) + 1;
}

export async function createCategory(formData: FormData): Promise<void> {
  const { supabase } = await requireAdminSession();

  const rawParentId = formData.get("parentId");
  const parsed = UpsertSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug") || slugify(String(formData.get("name") ?? "")),
    parentId: rawParentId ? String(rawParentId) : null,
    sortOrder: formData.get("sortOrder"),
  });

  if (!parsed.success) return;

  let level = 1;
  if (parsed.data.parentId) {
    const { data: parent } = await supabase
      .from("categories")
      .select("level")
      .eq("id", parsed.data.parentId)
      .single();
    level = levelFromParent(parent?.level ?? null);
  }

  const { error } = await supabase.from("categories").insert({
    name: parsed.data.name,
    slug: parsed.data.slug,
    parent_id: parsed.data.parentId,
    level,
    sort_order: parsed.data.sortOrder,
  });

  if (error) {
    if (isDuplicateSlugError(error)) {
      redirect("/categorias?error=slug_duplicado");
    }
    console.error("[admin/categorias] erro ao criar categoria:", error.message);
    redirect("/categorias?error=falha_ao_salvar");
  }

  updateTag("catalog");
  redirect("/categorias");
}

export async function updateCategory(id: string, formData: FormData): Promise<void> {
  const { supabase } = await requireAdminSession();

  const rawParentId = formData.get("parentId");
  const parsed = UpsertSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    parentId: rawParentId ? String(rawParentId) : null,
    sortOrder: formData.get("sortOrder"),
  });

  if (!parsed.success) return;

  let level = 1;
  if (parsed.data.parentId) {
    const { data: parent } = await supabase
      .from("categories")
      .select("level")
      .eq("id", parsed.data.parentId)
      .single();
    level = levelFromParent(parent?.level ?? null);
  }

  const { error } = await supabase
    .from("categories")
    .update({
      name: parsed.data.name,
      slug: parsed.data.slug,
      parent_id: parsed.data.parentId,
      level,
      sort_order: parsed.data.sortOrder,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    if (isDuplicateSlugError(error)) {
      redirect(`/categorias/${id}?error=slug_duplicado`);
    }
    console.error("[admin/categorias] erro ao editar categoria:", error.message);
    redirect(`/categorias/${id}?error=falha_ao_salvar`);
  }

  updateTag("catalog");
  redirect("/categorias");
}

export async function deleteCategory(formData: FormData): Promise<void> {
  const { supabase } = await requireAdminSession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const { data: categories } = await supabase.from("categories").select("id, parent_id");
  const { count } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("category_id", id);

  const guard = canDeleteCategory(
    id,
    (categories ?? []).map((c) => ({ id: c.id, parentId: c.parent_id })),
    new Map([[id, count ?? 0]]),
  );

  if (!guard.allowed) {
    console.warn("[admin/categorias] exclusão bloqueada:", guard.reason);
    return;
  }

  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) {
    console.error("[admin/categorias] erro ao excluir categoria:", error.message);
    return;
  }

  updateTag("catalog");
}
