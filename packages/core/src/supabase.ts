import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function getHubClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL e SUPABASE_ANON_KEY precisam estar definidos no ambiente.");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
