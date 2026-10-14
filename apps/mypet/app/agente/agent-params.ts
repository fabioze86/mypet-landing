const MAX_INITIAL_QUESTION = 500;

// ?pergunta= vindo da home: primeira ocorrência, sem espaços nas pontas, no
// máximo o tamanho que o agente aceita.
export function initialQuestionFrom(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = (value ?? "").trim().slice(0, MAX_INITIAL_QUESTION);
  return trimmed || null;
}
