import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function getHubClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL e SUPABASE_ANON_KEY precisam estar definidos no ambiente.");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

let warnedMissingServiceKey = false;

// Leituras do catálogo que trazem preço (product_channel_prices): a anon key é
// pública e o RLS não deixa anon ler preço, então elas rodam com service_role,
// só no servidor. Sem a chave no ambiente, cai para a anon: o site continua no
// ar, mas os preços vêm vazios ("Preço sob consulta") até a chave ser
// configurada no projeto da Vercel.
export function getCatalogClient(): SupabaseClient {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return getHubServiceClient();
  if (!warnedMissingServiceKey) {
    warnedMissingServiceKey = true;
    console.error("[catalog] SUPABASE_SERVICE_ROLE_KEY ausente: preços do catálogo vão aparecer vazios.");
  }
  return getHubClient();
}

export function getHubServiceClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar definidos no ambiente.",
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
