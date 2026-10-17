// Com streaming, só dá para trocar de provedor enquanto nada foi enviado ao
// navegador. Este helper lê o começo do stream: se o provedor falhar antes da
// primeira parte de conteúdo, tenta o próximo; depois disso, segue com ele.
// Devolve também quem respondeu e quem caiu, para a telemetria do agente.

export type StreamCandidate<T> = { provider: string; open: () => ReadableStream<T> };

export type StreamFailure = { provider: string; error: unknown };

export type StreamOpenResult<T> =
  | { stream: ReadableStream<T>; provider: string; index: number; failures: StreamFailure[] }
  | { stream: null; failures: StreamFailure[] };

const PRELUDE_TYPES = new Set(["start", "start-step"]);
const ABORTED = "abortado (timeout ou cancelamento)";

export async function openStreamWithFallback<T extends { type: string }>(
  candidates: StreamCandidate<T>[],
): Promise<StreamOpenResult<T>> {
  const failures: StreamFailure[] = [];

  for (const [index, candidate] of candidates.entries()) {
    let reader: ReadableStreamDefaultReader<T>;
    try {
      reader = candidate.open().getReader();
    } catch (error) {
      console.error(`[agent-stream] provedor "${candidate.provider}" falhou ao abrir:`, error);
      failures.push({ provider: candidate.provider, error });
      continue;
    }

    const buffered: T[] = [];
    let failure: { error: unknown } | null = null;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value.type === "error" || value.type === "abort") {
          const error = value.type === "abort" ? ABORTED : (value as { error?: unknown }).error;
          console.error(`[agent-stream] provedor "${candidate.provider}" falhou antes de responder:`, error);
          failure = { error };
          break;
        }
        buffered.push(value);
        if (!PRELUDE_TYPES.has(value.type)) break;
      }
    } catch (error) {
      console.error(`[agent-stream] provedor "${candidate.provider}" falhou antes de responder:`, error);
      failure = { error };
    }

    if (failure) {
      failures.push({ provider: candidate.provider, error: failure.error });
      reader.cancel().catch(() => {});
      continue;
    }

    const stream = new ReadableStream<T>({
      start(controller) {
        for (const part of buffered) controller.enqueue(part);
      },
      async pull(controller) {
        try {
          const { value, done } = await reader.read();
          if (done) controller.close();
          else controller.enqueue(value);
        } catch (error) {
          controller.error(error);
        }
      },
      cancel(reason) {
        return reader.cancel(reason);
      },
    });
    return { stream, provider: candidate.provider, index, failures };
  }
  return { stream: null, failures };
}
