import { getChannelCategories } from "@mypet/core/catalog";
import { requireAdminSession } from "@/lib/auth";
import { assignDistribuidoraCategory } from "./actions";

const Channel = "ffa_fabrica";

type ProductRow = {
  id: string;
  name: string;
  reference: string | null;
  product_channel_categories: { category_id: string }[] | null;
};

export default async function DistribuidoraCategoriasPage() {
  const { supabase } = await requireAdminSession();
  const [categoriesResult, productsResult] = await Promise.all([
    getChannelCategories(Channel),
    supabase
      .from("products")
      .select("id, name, reference, product_channel_categories(category_id, channel), product_channel_links!inner(channel)")
      .eq("status", "active")
      .neq("product_role", "variant")
      .eq("product_channel_links.channel", Channel)
      .eq("product_channel_categories.channel", Channel)
      .order("name"),
  ]);
  const categories = categoriesResult;
  const products = (productsResult.data ?? []) as unknown as ProductRow[];

  return (
    <section>
      <h1 className="text-2xl font-bold text-slate-900">Categorias da Distribuidora</h1>
      <p className="mt-2 text-sm text-slate-600">Classifique cada produto em uma das cinco categorias exclusivas da Distribuidora.</p>
      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3">Produto</th><th className="px-4 py-3">ReferÃªncia</th><th className="px-4 py-3">Categoria</th></tr></thead>
          <tbody>
            {products.map((product) => {
              const current = product.product_channel_categories?.[0]?.category_id ?? "";
              return <tr key={product.id} className="border-t border-slate-100"><td className="px-4 py-3 font-medium text-slate-800">{product.name}</td><td className="px-4 py-3 text-slate-500">{product.reference ?? "â€”"}</td><td className="px-4 py-3"><form action={assignDistribuidoraCategory} className="flex gap-2"><input type="hidden" name="productId" value={product.id} /><select name="categoryId" defaultValue={current} className="rounded border border-slate-300 px-2 py-1"><option value="">Sem categoria</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><button type="submit" className="rounded bg-slate-800 px-3 py-1 text-white">Salvar</button></form></td></tr>;
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
