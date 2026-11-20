// Consulta pública da ReceitaWS (sem token, ~3 consultas/min; 429 quando passa).
// Copiado e reduzido de Hub Comercial V2/hub-clientes/lib/integracoes/receitaws/client.ts.

export type ReceitaConsulta =
  | { kind: "localizado"; uf: string; municipio: string | null; cep: string | null }
  | { kind: "nao_localizado" }
  | { kind: "indisponivel" };

type ReceitaWsResponse = { status?: string; uf?: string; municipio?: string; cep?: string };

const onlyDigits = (v: string) => v.replace(/\D/g, "");

export async function consultarCnpj(
  cnpj: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 5000,
): Promise<ReceitaConsulta> {
  const digitos = onlyDigits(cnpj ?? "");
  if (digitos.length !== 14) return { kind: "nao_localizado" };

  let resposta: Response;
  try {
    resposta = await fetchImpl(`https://www.receitaws.com.br/v1/cnpj/${digitos}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    return { kind: "indisponivel" };
  }
  if (!resposta.ok) return { kind: "indisponivel" };

  let data: ReceitaWsResponse;
  try {
    data = (await resposta.json()) as ReceitaWsResponse;
  } catch {
    return { kind: "indisponivel" };
  }
  if (data.status === "ERROR" || !data.uf) return { kind: "nao_localizado" };
  const cep = data.cep ? onlyDigits(data.cep) : "";
  return {
    kind: "localizado",
    uf: data.uf.trim().toUpperCase(),
    municipio: data.municipio?.trim() || null,
    cep: cep.length === 8 ? cep : null,
  };
}
