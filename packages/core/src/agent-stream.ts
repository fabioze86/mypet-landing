// Com streaming, só dá para trocar de provedor enquanto nada foi enviado ao
// navegador. Este helper lê o começo do stream: se o provedor falhar antes da
// primeira parte de conteúdo, tenta o próximo; depois disso, segue com ele.

export type StreamCandidate<T> = { provider: string; open: () => ReadableStream<T> };

const PRELUDE_TYPES = new Set(["start", "start-step"]);

export async function openStreamWithFallback<T extends { type: string }>(
  candidates: StreamCandidate<T>[],
): Promise<ReadableStream<T> | null> {
  for (const candidate of candidates) {
    let reader: ReadableStreamDefaultReader<T>;
    try {
      reader = candidate.open().getReader();
    } catch (error) {
      console.error(`[agent-stream] provedor "${candidate.provider}" falhou ao abrir:`, error);
      continue;
    }

    const buffered: T[] = [];
    let failed = false;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value.type === "error") {
          console.error(
            `[agent-stream] provedor "${candidate.provider}" falhou antes de responder:`,
            (value as { error?: unknown }).error,
          );
          failed = true;
          break;
        }
        buffered.push(value);
        if (!PRELUDE_TYPES.has(value.type)) break;
      }
    } catch (error) {
      console.error(`[agent-stream] provedor "${candidate.provider}" falhou antes de responder:`, error);
      failed = true;
    }

    if (failed) {
      reader.cancel().catch(() => {});
      continue;
    }

    return new ReadableStream<T>({
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
  }
  return null;
}
