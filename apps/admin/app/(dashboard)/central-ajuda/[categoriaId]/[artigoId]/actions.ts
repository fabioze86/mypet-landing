"use server";

import { z } from "zod";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/auth";
import { isDuplicateSlugError } from "@/lib/categories";
import { revalidarCentralAjudaPublica } from "@/lib/central-ajuda-revalidation";

const ArtigoSchema = z.object({
  titulo: z.string().min(1, "Informe o título."),
  slug: z.string().min(1, "Informe o slug."),
  resumo: z.string(),
  corpoMarkdown: z.string(),
  palavrasChave: z.string(),
  notaInterna: z.string(),
  ordem: z.coerce.number().int().default(0),
});

export async function updateArtigoAjuda(
  id: string,
  categoriaId: string,
  formData: FormData,
): Promise<void> {
  const { supabase, name } = await requireAdminSession();

  const parsed = ArtigoSchema.safeParse({
    titulo: formData.get("titulo"),
    slug: formData.get("slug"),
    resumo: formData.get("resumo") ?? "",
    corpoMarkdown: formData.get("corpoMarkdown") ?? "",
    palavrasChave: formData.get("palavrasChave") ?? "",
    notaInterna: formData.get("notaInterna") ?? "",
    ordem: formData.get("ordem"),
  });
  if (!parsed.success) return;

  const { error } = await supabase
    .from("artigos_ajuda")
    .update({
      titulo: parsed.data.titulo,
      slug: parsed.data.slug,
      resumo: parsed.data.resumo,
      corpo_markdown: parsed.data.corpoMarkdown,
      palavras_chave: parsed.data.palavrasChave,
      nota_interna: parsed.data.notaInterna || null,
      ordem: parsed.data.ordem,
      atualizado_por: name,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    if (isDuplicateSlugError(error)) {
      redirect(`/central-ajuda/${categoriaId}/${id}?error=slug_duplicado`);
    }
    console.error("[admin/central-ajuda] erro ao editar artigo:", error.message);
    redirect(`/central-ajuda/${categoriaId}/${id}?error=falha_ao_salvar`);
  }

  updateTag("central-ajuda");
  await revalidarCentralAjudaPublica();
  redirect(`/central-ajuda/${categoriaId}`);
}
