/**
 * apps/admin e apps/mypet são deployments Next.js separados, cada um com seu
 * próprio Data Cache. `updateTag("central-ajuda")` dentro de uma Server
 * Action do admin só invalida o cache do próprio admin — o site público
 * (apps/mypet) manteria a versão antiga de um artigo publicado/despublicado
 * até o cacheLife("days") expirar sozinho. Esta função chama a rota de
 * revalidação exposta por apps/mypet para expirar o cache de lá também.
 *
 * É best-effort de propósito: se a chamada falhar (rede, apps/mypet fora do
 * ar, variável de ambiente não configurada), só logamos um aviso — os dados
 * do admin já foram salvos corretamente de qualquer forma, e o site público
 * ainda vai atualizar sozinho quando o cache expirar. Por isso a Server
 * Action que chama isto não deve aguardar nem falhar por causa dela.
 */
export async function revalidarCentralAjudaPublica(): Promise<void> {
  const url = process.env.MYPET_APP_URL
    ? `${process.env.MYPET_APP_URL.replace(/\/$/, "")}/api/revalidate-central-ajuda`
    : undefined;
  const secret = process.env.REVALIDATE_CENTRAL_AJUDA_SECRET;

  if (!url || !secret) {
    console.warn("[admin/central-ajuda] MYPET_APP_URL ou REVALIDATE_CENTRAL_AJUDA_SECRET não configurados — pulei a revalidação do site público.");
    return;
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
      cache: "no-store",
    });
    if (!response.ok) {
      console.warn("[admin/central-ajuda] falha ao revalidar o site público:", response.status);
    }
  } catch (error) {
    console.warn("[admin/central-ajuda] erro ao acessar o site público para revalidar:", error);
  }
}
