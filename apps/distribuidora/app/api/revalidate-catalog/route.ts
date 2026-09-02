import { revalidateTag } from "next/cache";
import { createCatalogRevalidationHandler } from "@mypet/core/catalog-revalidation";

export const POST = createCatalogRevalidationHandler({
  secret: process.env.CATALOG_REVALIDATE_SECRET,
  // Em Route Handlers, `updateTag` não é permitido. `expire: 0` força que a
  // próxima visita busque dados novos, sem entregar a versão antiga.
  invalidateCatalog: () => revalidateTag("catalog", { expire: 0 }),
});
