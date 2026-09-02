type CatalogRevalidationOptions = {
  secret: string | undefined;
  invalidateCatalog: () => void;
};

/**
 * Cria uma rota protegida para expirar os dados cacheados do catálogo.
 * A importação de preços pode chamá-la após concluir a escrita no Hub.
 */
export function createCatalogRevalidationHandler({
  secret,
  invalidateCatalog,
}: CatalogRevalidationOptions) {
  return async function POST(request: Request): Promise<Response> {
    const authorization = request.headers.get("authorization");
    if (!secret || authorization !== `Bearer ${secret}`) {
      return Response.json({ error: "Não autorizado" }, { status: 401 });
    }

    invalidateCatalog();
    return Response.json({ ok: true });
  };
}
