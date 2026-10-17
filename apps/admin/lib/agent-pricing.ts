// Preço em US$ por milhão de tokens (entrada/saída) dos modelos que o agente
// /agente usa. Os de gemini-2.5-flash e claude-haiku-4-5 foram conferidos nas
// páginas oficiais em 2026-10-17. O de gpt-4o-mini NÃO foi conferido na página
// oficial (a OpenAI bloqueou o acesso em 2026-10-17): é o valor do anúncio do
// modelo. Atualizar à mão quando mudar. O painel mostra o custo sempre como
// estimativa.
export const MODEL_PRICES_USD_PER_MILLION: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gemini-2.5-flash": { input: 0.3, output: 2.5 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};

export type ModelUsage = { model: string; input_tokens: number; output_tokens: number };

/** Custo estimado em US$; null quando o modelo não está na tabela. */
export function estimateCostUsd(
  model: string | null,
  inputTokens: number | null,
  outputTokens: number | null,
): number | null {
  if (!model) return null;
  const price = MODEL_PRICES_USD_PER_MILLION[model];
  if (!price) return null;
  return ((inputTokens ?? 0) * price.input + (outputTokens ?? 0) * price.output) / 1_000_000;
}

export function totalCostUsd(usage: ModelUsage[]): { costUsd: number; unpricedModels: string[] } {
  let costUsd = 0;
  const unpricedModels: string[] = [];
  for (const row of usage) {
    const cost = estimateCostUsd(row.model, Number(row.input_tokens), Number(row.output_tokens));
    if (cost === null) unpricedModels.push(row.model);
    else costUsd += cost;
  }
  return { costUsd, unpricedModels };
}

const USD = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatUsd(value: number): string {
  if (value > 0 && value < 0.01) return "< US$ 0,01";
  return `US$ ${USD.format(value)}`;
}
