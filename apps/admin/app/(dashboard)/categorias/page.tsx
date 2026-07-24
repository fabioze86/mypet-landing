import Link from "next/link";
import { getCategories } from "@mypet/core/catalog";
import { buildCategoryTree, type CategoryTreeNode } from "@mypet/core/catalog-utils";
import { requireAdminSession } from "@/lib/auth";
import { flattenForSelect, canDeleteCategory } from "@/lib/categories";
import { createCategory, deleteCategory } from "./actions";

function TreeRows({ nodes, depth = 0 }: { nodes: CategoryTreeNode[]; depth?: number }) {
  return (
    <>
      {nodes.map((node) => (
        <>
          <tr key={node.id} className="border-b border-slate-100">
            <td className="px-4 py-3" style={{ paddingLeft: 16 + depth * 20 }}>{node.name}</td>
            <td className="px-4 py-3 text-slate-500">{node.slug}</td>
            <td className="px-4 py-3">
              <Link href={`/categorias/${node.id}`} className="text-sm font-semibold text-slate-700 underline">
                Editar
              </Link>
            </td>
            <td className="px-4 py-3">
              <DeleteButton id={node.id} hasChildren={node.children.length > 0} />
            </td>
          </tr>
          <TreeRows nodes={node.children} depth={depth + 1} />
        </>
      ))}
    </>
  );
}

function DeleteButton({ id, hasChildren }: { id: string; hasChildren: boolean }) {
  const guard = canDeleteCategory(id, hasChildren ? [{ id: "child", parentId: id }] : [], new Map());
  return (
    <form action={deleteCategory}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={!guard.allowed}
        title={guard.reason ?? undefined}
        className="rounded-lg px-3 py-1 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
      >
        Excluir
      </button>
    </form>
  );
}

const ERROR_MESSAGES: Record<string, string> = {
  slug_duplicado: "Já existe uma categoria com esse slug. Escolha outro.",
  falha_ao_salvar: "Não foi possível salvar a categoria. Tente novamente.",
};

export default async function CategoriasPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdminSession();
  const { error } = await searchParams;
  const categories = await getCategories();
  const tree = buildCategoryTree(categories);
  const options = flattenForSelect(tree);

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold text-slate-800">Categorias</h1>

      {error && ERROR_MESSAGES[error] && (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{ERROR_MESSAGES[error]}</p>
      )}

      <form action={createCategory} className="mb-8 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Nome</label>
          <input name="name" required className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Slug (opcional)</label>
          <input name="slug" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Categoria pai</label>
          <select name="parentId" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">— nenhuma (nível 1) —</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Ordem</label>
          <input name="sortOrder" type="number" defaultValue={0} className="w-20 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <button type="submit" className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white">
          Criar categoria
        </button>
      </form>

      <table className="w-full border-collapse overflow-hidden rounded-xl border border-slate-200 bg-white text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
            <th className="px-4 py-3">Nome</th>
            <th className="px-4 py-3">Slug</th>
            <th className="px-4 py-3"></th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          <TreeRows nodes={tree} />
        </tbody>
      </table>
    </div>
  );
}
