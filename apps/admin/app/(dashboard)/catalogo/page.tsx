import { refreshDistribuidoraCatalog } from "./actions";

export default async function CatalogoPage({
  searchParams,
}: {
  searchParams: Promise<{ updated?: string; error?: string }>;
}) {
  const { updated, error } = await searchParams;
  const message =
    error === "configuracao"
      ? "A atualização ainda não foi configurada. Informe as variáveis de ambiente do Admin e da Distribuidora."
      : error === "atualizacao"
        ? "Não foi possível atualizar o catálogo. Confira a URL e o segredo configurados."
        : null;

  return (
    <section className="max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900">Catálogo</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Depois de importar os preços no canal FFA Fábrica, atualize o catálogo para a Distribuidora mostrar os valores novos imediatamente.
      </p>

      {updated === "1" && (
        <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Catálogo atualizado. Os próximos acessos já receberão os preços importados.
        </p>
      )}
      {message && (
        <p className="mt-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800">{message}</p>
      )}

      <form action={refreshDistribuidoraCatalog} className="mt-6">
        <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
          Atualizar catálogo
        </button>
      </form>
    </section>
  );
}
