import { revalidateTag } from "next/cache";
import { createCatalogRevalidationHandler } from "@mypet/core/catalog-revalidation";

// Reaproveita o handler genérico já usado por /api/revalidate-catalog (apesar
// do nome, ele só faz um POST com Bearer secret que dispara um callback — não
// tem nada específico de catálogo). apps/admin e apps/mypet são deployments
// separados, cada um com seu próprio Data Cache; publicar/despublicar um
// artigo em apps/admin só invalida o cache de lá, então apps/admin chama esta
// rota logo depois para expirar o cache de apps/mypet também.
export const POST = createCatalogRevalidationHandler({
  secret: process.env.REVALIDATE_CENTRAL_AJUDA_SECRET,
  invalidateCatalog: () => revalidateTag("central-ajuda", { expire: 0 }),
});
