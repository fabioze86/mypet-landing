"use server";

import { z } from "zod";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/auth";
import { slugify, isDuplicateSlugError } from "@/lib/categories";
import { revalidarCentralAjudaPublica } from "@/lib/central-ajuda-revalidation";

const NovoArtigoSchema = z.object({
  titulo: z.string().min(1, "Informe o título."),
  slug: z.string().min(1, "Informe o slug."),
});

export async function createArtigoAjuda(categoriaId: string, formData: FormData): Promise<void> {
  const { supabase, name } = await requireAdminSession();

  const parsed = NovoArtigoSchema.safeParse({
    titulo: formData.get("titulo"),
    slug: formData.get("slug") || slugify(String(formData.get("titulo") ?? "")),
  });
  if (!parsed.success) return;

  const { data, error } = await supabase
    .from("artigos_ajuda")
    .insert({
      categoria_id: categoriaId,
      titulo: parsed.data.titulo,
      slug: parsed.data.slug,
      atualizado_por: name,
    })
    .select("id")
    .single();

  if (error || !data) {
    if (isDuplicateSlugError(error)) {
      redirect(`/central-ajuda/${categoriaId}?error=slug_duplicado`);
    }
    console.error("[admin/central-ajuda] erro ao criar artigo:", error?.message);
    redirect(`/central-ajuda/${categoriaId}?error=falha_ao_salvar`);
  }

  updateTag("central-ajuda");
  await revalidarCentralAjudaPublica();
  redirect(`/central-ajuda/${categoriaId}/${data.id}`);
}

export async function alternarStatusArtigoAjuda(
  id: string,
  categoriaId: string,
  formData: FormData,
): Promise<void> {
  const { supabase } = await requireAdminSession();
  const novoStatus = String(formData.get("novoStatus") ?? "");
  if (novoStatus !== "publicado" && novoStatus !== "rascunho") return;

  if (novoStatus === "publicado") {
    const { data: artigo } = await supabase
      .from("artigos_ajuda")
      .select("resumo, corpo_markdown")
      .eq("id", id)
      .single();
    if (!artigo?.resumo?.trim() || !artigo?.corpo_markdown?.trim()) {
      redirect(`/central-ajuda/${categoriaId}?error=artigo_incompleto`);
    }
  }

  const { error } = await supabase
    .from("artigos_ajuda")
    .update({ status: novoStatus, atualizado_em: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("[admin/central-ajuda] erro ao alternar status:", error.message);
    redirect(`/central-ajuda/${categoriaId}?error=falha_ao_salvar`);
  }

  updateTag("central-ajuda");
  await revalidarCentralAjudaPublica();
  redirect(`/central-ajuda/${categoriaId}`);
}
