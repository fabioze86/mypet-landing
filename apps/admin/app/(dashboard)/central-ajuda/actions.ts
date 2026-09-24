"use server";

import { z } from "zod";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/auth";
import { slugify, isDuplicateSlugError } from "@/lib/categories";
import { revalidarCentralAjudaPublica } from "@/lib/central-ajuda-revalidation";
import { ICONES_AJUDA } from "./icones";

const CategoriaSchema = z.object({
  titulo: z.string().min(1, "Informe o título."),
  slug: z.string().min(1, "Informe o slug."),
  descricao: z.string().min(1, "Informe a descrição."),
  icone: z.enum(ICONES_AJUDA),
  ordem: z.coerce.number().int().default(0),
});

export async function createCategoriaAjuda(formData: FormData): Promise<void> {
  const { supabase, name } = await requireAdminSession();

  const parsed = CategoriaSchema.safeParse({
    titulo: formData.get("titulo"),
    slug: formData.get("slug") || slugify(String(formData.get("titulo") ?? "")),
    descricao: formData.get("descricao"),
    icone: formData.get("icone"),
    ordem: formData.get("ordem"),
  });
  if (!parsed.success) return;

  const { error } = await supabase.from("categorias_ajuda").insert({
    titulo: parsed.data.titulo,
    slug: parsed.data.slug,
    descricao: parsed.data.descricao,
    icone: parsed.data.icone,
    ordem: parsed.data.ordem,
    atualizado_por: name,
  });

  if (error) {
    if (isDuplicateSlugError(error)) {
      redirect("/central-ajuda?error=slug_duplicado");
    }
    console.error("[admin/central-ajuda] erro ao criar categoria:", error.message);
    redirect("/central-ajuda?error=falha_ao_salvar");
  }

  updateTag("central-ajuda");
  await revalidarCentralAjudaPublica();
  redirect("/central-ajuda");
}

export async function updateCategoriaAjuda(id: string, formData: FormData): Promise<void> {
  const { supabase, name } = await requireAdminSession();

  const parsed = CategoriaSchema.safeParse({
    titulo: formData.get("titulo"),
    slug: formData.get("slug"),
    descricao: formData.get("descricao"),
    icone: formData.get("icone"),
    ordem: formData.get("ordem"),
  });
  if (!parsed.success) return;

  const { error } = await supabase
    .from("categorias_ajuda")
    .update({
      titulo: parsed.data.titulo,
      slug: parsed.data.slug,
      descricao: parsed.data.descricao,
      icone: parsed.data.icone,
      ordem: parsed.data.ordem,
      atualizado_por: name,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    if (isDuplicateSlugError(error)) {
      redirect(`/central-ajuda/${id}?error=slug_duplicado`);
    }
    console.error("[admin/central-ajuda] erro ao editar categoria:", error.message);
    redirect(`/central-ajuda/${id}?error=falha_ao_salvar`);
  }

  updateTag("central-ajuda");
  await revalidarCentralAjudaPublica();
  redirect("/central-ajuda");
}
