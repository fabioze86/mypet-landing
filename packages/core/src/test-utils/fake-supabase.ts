import type { SupabaseClient } from "@supabase/supabase-js";

// Fake mínimo do query builder do Supabase para testes. Cada `from(tabela)`
// consome, na ordem, um resultado da fila daquela tabela quando a consulta é
// aguardada (await) ou finalizada com maybeSingle(). Todas as chamadas ficam
// registradas em `calls` para asserções.

export type FakeResult = { data?: unknown; error?: { message: string; code?: string } | null };
export type FakeCall = { table: string; method: string; args: unknown[] };

const CHAIN_METHODS = ["select", "eq", "is", "order", "limit", "insert", "update", "upsert"] as const;

export function fakeSupabase(results: Record<string, FakeResult[]>) {
  const calls: FakeCall[] = [];
  const queues: Record<string, FakeResult[]> = Object.fromEntries(
    Object.entries(results).map(([table, list]) => [table, [...list]]),
  );

  const client = {
    from(table: string) {
      const next = () =>
        Promise.resolve({ data: null, error: null, ...(queues[table]?.shift() ?? {}) });
      const builder: Record<string, unknown> = {};
      for (const method of CHAIN_METHODS) {
        builder[method] = (...args: unknown[]) => {
          calls.push({ table, method, args });
          return builder;
        };
      }
      builder.maybeSingle = () => {
        calls.push({ table, method: "maybeSingle", args: [] });
        return next();
      };
      builder.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
        next().then(resolve, reject);
      return builder;
    },
  };

  return { client: client as unknown as SupabaseClient, calls };
}
