import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { getHubServiceClient } from "@mypet/core/supabase";

// Preenche buyers.uf/municipio/cep a partir do cache da ReceitaWS do Hub Clientes
// (projeto Supabase "Clientes", schema leads). Roda localmente, uma vez.
//   CLIENTES_SUPABASE_URL=... CLIENTES_SUPABASE_SERVICE_ROLE_KEY=... pnpm buyers:backfill-localizacao --dry-run
// SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY (hub_catalogo) vêm do .env, como nos outros scripts.

export type CacheRow = { cnpj: string; status_consulta: string; uf: string | null; municipio: string | null; cep: string | null };
export type BackfillUpdate = { id: string; uf: string; municipio: string | null; cep: string | null };

const digits = (v: string | null | undefined) => String(v ?? "").replace(/\D/g, "");

export function planejarBackfill(buyers: { id: string; cnpj: string | null }[], cache: CacheRow[]): BackfillUpdate[] {
  const porCnpj = new Map(cache.map((row) => [digits(row.cnpj), row]));
  const updates: BackfillUpdate[] = [];
  for (const buyer of buyers) {
    const row = porCnpj.get(digits(buyer.cnpj));
    if (!row || row.status_consulta !== "consultado" || !row.uf) continue;
    const cep = digits(row.cep);
    updates.push({ id: buyer.id, uf: row.uf.trim().toUpperCase(), municipio: row.municipio?.trim() || null, cep: cep.length === 8 ? cep : null });
  }
  return updates;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const url = process.env.CLIENTES_SUPABASE_URL;
  const key = process.env.CLIENTES_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Defina CLIENTES_SUPABASE_URL e CLIENTES_SUPABASE_SERVICE_ROLE_KEY no terminal.");

  const hub = getHubServiceClient();
  const clientes = createClient(url, key, { auth: { persistSession: false } });

  const { data: buyers, error: bErr } = await hub.from("buyers").select("id, cnpj").is("localizacao_status", null);
  if (bErr) throw new Error(bErr.message);
  const cnpjs = [...new Set((buyers ?? []).map((b) => digits(b.cnpj)).filter((c) => c.length === 14))];

  const cache: CacheRow[] = [];
  for (let i = 0; i < cnpjs.length; i += 200) {
    const { data, error } = await clientes
      .schema("leads")
      .from("cnpj_receita_cache")
      .select("cnpj, status_consulta, uf, municipio, cep")
      .in("cnpj", cnpjs.slice(i, i + 200));
    if (error) throw new Error(error.message);
    cache.push(...((data ?? []) as CacheRow[]));
  }

  const updates = planejarBackfill(buyers ?? [], cache);
  console.log(`Pendentes: ${buyers?.length ?? 0} · no cache: ${cache.length} · a preencher: ${updates.length}`);
  if (dryRun) return;

  const agora = new Date().toISOString();
  for (const u of updates) {
    const { error } = await hub
      .from("buyers")
      .update({ uf: u.uf, municipio: u.municipio, cep: u.cep, localizacao_status: "localizado", localizado_em: agora })
      .eq("id", u.id);
    if (error) console.error(`Falha em ${u.id}: ${error.message}`);
  }
  console.log("Concluído.");
}

if (process.argv[1]?.endsWith("backfill-buyers-localizacao.ts")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
