import { notFound } from "next/navigation";
import { requireAdminSession } from "@/lib/auth";
import { ICONES_AJUDA, updateCategoriaAjuda } from "../actions";

const ERROR_MESSAGES: Record<string, string> = {
  slug_duplicado: "Já existe uma categoria com esse slug. Escolha outro.",
  falha_ao_salvar: "Não foi possível salvar a categoria. Tente novamente.",
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
    </div>
  );
}
