import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdminSession } from "@/lib/auth";
import { updateCategoriaAjuda } from "../actions";
import { ICONES_AJUDA } from "../icones";
import { createArtigoAjuda, alternarStatusArtigoAjuda } from "./artigos-actions";

const ERROR_MESSAGES: Record<string, string> = {
  slug_duplicado: "Já existe uma categoria com esse slug. Escolha outro.",
  falha_ao_salvar: "Não foi possível salvar a categoria. Tente novamente.",
  artigo_incompleto: "Preencha resumo e corpo do artigo antes de publicar.",
};

export default async function EditCategoriaAjudaPage({
  params,
  searchParams,
}: {
  params: Promise<{ categoriaId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { supabase } = await requireAdminSession();
  const { categoriaId } = await params;
  const { error } = await searchParams;

  const { data: categoria } = await supabase
    .from("categorias_ajuda")
    .select("id, titulo, slug, descricao, icone, ordem")
    .eq("id", categoriaId)
    .single();
  if (!categoria) notFound();

  const { data: artigos } = await supabase
    .from("artigos_ajuda")
    .select("id, titulo, slug, status, ordem")
    .eq("categoria_id", categoriaId)
    .order("ordem", { ascending: true });

  const updateWithId = updateCategoriaAjuda.bind(null, categoriaId);

  return (
    <div className="max-w-lg">
      <h1 className="mb-6 text-xl font-bold text-slate-800">Editar categoria</h1>

      {error && ERROR_MESSAGES[error] && (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{ERROR_MESSAGES[error]}</p>
      )}

      <form action={updateWithId} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Título</label>
          <input name="titulo" defaultValue={categoria.titulo} required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Slug</label>
          <input name="slug" defaultValue={categoria.slug} required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Descrição</label>
          <input name="descricao" defaultValue={categoria.descricao} required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Ícone</label>
          <select name="icone" defaultValue={categoria.icone} required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            {ICONES_AJUDA.map((icone) => (
              <option key={icone} value={icone}>{icone}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Ordem</label>
          <input name="ordem" type="number" defaultValue={categoria.ordem} className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <button type="submit" className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white">
          Salvar
        </button>
      </form>

      <h2 className="mb-4 mt-10 text-lg font-bold text-slate-800">Artigos</h2>

      <form
        action={createArtigoAjuda.bind(null, categoriaId)}
        className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4"
      >
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Título do artigo novo</label>
          <input name="titulo" required className="w-72 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Slug (opcional)</label>
          <input name="slug" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <button type="submit" className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white">
          Criar artigo (rascunho)
        </button>
      </form>

      <table className="w-full overflow-hidden rounded-xl border border-slate-200 bg-white text-sm">
        <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3">Título</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3" />
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {(artigos ?? []).map((artigo) => (
            <tr key={artigo.id} className="border-b border-slate-100">
              <td className="px-4 py-3">{artigo.titulo}</td>
              <td className="px-4 py-3">
                <span className={artigo.status === "publicado" ? "text-emerald-600" : "text-amber-600"}>
                  {artigo.status}
                </span>
              </td>
              <td className="px-4 py-3">
                <Link href={`/central-ajuda/${categoriaId}/${artigo.id}`} className="text-sm font-semibold text-slate-700 underline">
                  Editar
                </Link>
              </td>
              <td className="px-4 py-3">
                <form action={alternarStatusArtigoAjuda.bind(null, artigo.id, categoriaId)}>
                  <input type="hidden" name="novoStatus" value={artigo.status === "publicado" ? "rascunho" : "publicado"} />
                  <button type="submit" className="rounded-lg px-3 py-1 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                    {artigo.status === "publicado" ? "Despublicar" : "Publicar"}
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
