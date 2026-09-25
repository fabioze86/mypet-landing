import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdminSession } from "@/lib/auth";
import { updateArtigoAjuda } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  slug_duplicado: "Já existe um artigo com esse slug. Escolha outro.",
  falha_ao_salvar: "Não foi possível salvar o artigo. Tente novamente.",
};

export default async function EditArtigoAjudaPage({
  params,
  searchParams,
}: {
  params: Promise<{ categoriaId: string; artigoId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { supabase } = await requireAdminSession();
  const { categoriaId, artigoId } = await params;
  const { error } = await searchParams;

  const { data: artigo } = await supabase
    .from("artigos_ajuda")
    .select("id, titulo, slug, resumo, corpo_markdown, palavras_chave, nota_interna, ordem, status")
    .eq("id", artigoId)
    .single();
  if (!artigo) notFound();

  const updateWithIds = updateArtigoAjuda.bind(null, artigoId, categoriaId);

  return (
    <div className="max-w-3xl">
      <Link href={`/central-ajuda/${categoriaId}`} className="mb-4 inline-block text-sm font-semibold text-slate-500 hover:text-slate-700">
        &larr; Voltar para a categoria
      </Link>
      <h1 className="mb-1 text-xl font-bold text-slate-800">Editar artigo</h1>
      <p className="mb-6 text-sm text-slate-500">
        Status atual: <span className={artigo.status === "publicado" ? "text-emerald-600" : "text-amber-600"}>{artigo.status}</span>
        {" — para publicar ou despublicar, volte para a lista da categoria."}
      </p>

      {error && ERROR_MESSAGES[error] && (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{ERROR_MESSAGES[error]}</p>
      )}

      <form action={updateWithIds} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Título</label>
          <input name="titulo" defaultValue={artigo.titulo} required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Slug</label>
          <input name="slug" defaultValue={artigo.slug} required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Resumo</label>
          <input name="resumo" defaultValue={artigo.resumo} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Corpo (Markdown)</label>
          <textarea
            name="corpoMarkdown"
            defaultValue={artigo.corpo_markdown}
            rows={20}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Palavras-chave (separadas por espaço)</label>
          <input name="palavrasChave" defaultValue={artigo.palavras_chave} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Nota interna (não aparece pro público)</label>
          <textarea
            name="notaInterna"
            defaultValue={artigo.nota_interna ?? ""}
            rows={3}
            className="w-full rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Ordem</label>
          <input name="ordem" type="number" defaultValue={artigo.ordem} className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <button type="submit" className="self-start rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white">
          Salvar
        </button>
      </form>
    </div>
  );
}
