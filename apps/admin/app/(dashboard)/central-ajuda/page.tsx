import Link from "next/link";
import { requireAdminSession } from "@/lib/auth";
import { createCategoriaAjuda } from "./actions";
import { ICONES_AJUDA } from "./icones";

const ERROR_MESSAGES: Record<string, string> = {
  slug_duplicado: "Já existe uma categoria com esse slug. Escolha outro.",
  falha_ao_salvar: "Não foi possível salvar a categoria. Tente novamente.",
};

type CategoriaRow = {
  id: string;
  titulo: string;
  slug: string;
  ordem: number;
  artigos: { id: string; titulo: string }[];
};

export default async function CentralAjudaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { supabase } = await requireAdminSession();
  const { error } = await searchParams;

  const { data: categorias } = await supabase
    .from("categorias_ajuda")
    .select("id, titulo, slug, ordem, artigos:artigos_ajuda(id, titulo, ordem)")
    .order("ordem", { ascending: true })
    .order("ordem", { referencedTable: "artigos_ajuda", ascending: true });

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold text-slate-800">Central de Ajuda</h1>

      {error && ERROR_MESSAGES[error] && (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{ERROR_MESSAGES[error]}</p>
      )}

      <form action={createCategoriaAjuda} className="mb-8 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Título</label>
          <input name="titulo" required className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Slug (opcional)</label>
          <input name="slug" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Descrição</label>
          <input name="descricao" required className="w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Ícone</label>
          <select name="icone" required className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            {ICONES_AJUDA.map((icone) => (
              <option key={icone} value={icone}>{icone}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Ordem</label>
          <input name="ordem" type="number" defaultValue={0} className="w-20 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <button type="submit" className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white">
          Criar categoria
        </button>
      </form>

      <table className="w-full overflow-hidden rounded-xl border border-slate-200 bg-white text-sm">
        <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3">Título</th>
            <th className="px-4 py-3">Slug</th>
            <th className="px-4 py-3">Artigos</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {((categorias ?? []) as CategoriaRow[]).map((categoria) => (
            <tr key={categoria.id} className="border-b border-slate-100 align-top">
              <td className="px-4 py-3">{categoria.titulo}</td>
              <td className="px-4 py-3 text-slate-500">{categoria.slug}</td>
              <td className="px-4 py-3">
                {categoria.artigos?.length ? (
                  <ul className="flex flex-col gap-1">
                    {categoria.artigos.map((artigo) => (
                      <li key={artigo.id}>
                        <Link
                          href={`/central-ajuda/${categoria.id}/${artigo.id}`}
                          className="text-slate-600 underline decoration-slate-300 hover:text-slate-800"
                        >
                          {artigo.titulo}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-slate-400">Nenhum artigo</span>
                )}
              </td>
              <td className="px-4 py-3">
                <Link href={`/central-ajuda/${categoria.id}`} className="text-sm font-semibold text-slate-700 underline">
                  Editar
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
