import { getHubServiceClient } from "./supabase";

export type PreAccessInput = { cnpj: string; whatsapp: string; email?: string | null };
export type NormalizedInput = { cnpj: string; whatsapp: string; email: string | null };
export type PreAccessErrorCode =
  | "INVALID_INPUT"
  | "INVALID_CNPJ"
  | "INVALID_WHATSAPP"
  | "INVALID_EMAIL"
  | "WHATSAPP_MISMATCH"
  | "RATE_LIMITED"
  | "UNAVAILABLE";

export class PreAccessError extends Error {
  constructor(public readonly code: PreAccessErrorCode) {
    super(code);
    this.name = "PreAccessError";
  }
}

const RATE_WINDOW_MS = 5 * 60 * 1000;
const RATE_MAX = 5;
const MAX_FIELD_LEN = 120;

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function normalizePreAccessInput(input: unknown): NormalizedInput {
  const raw = (input ?? {}) as Record<string, unknown>;
  const email = str(raw.email).trim().toLowerCase();
  const whatsapp = str(raw.whatsapp).replace(/\D/g, "");
  return {
    cnpj: str(raw.cnpj).replace(/\D/g, ""),
    whatsapp: /^\d{10,11}$/.test(whatsapp) ? `55${whatsapp}` : whatsapp,
    email: email.length > 0 ? email : null,
  };
}

function isValidCnpj(cnpj: string): boolean {
  if (!/^\d{14}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false;
  const digit = (length: number) => {
    let weight = length - 7;
    const sum = cnpj
      .slice(0, length)
      .split("")
      .reduce((total, char) => {
        const next = total + Number(char) * weight;
        weight = weight === 2 ? 9 : weight - 1;
        return next;
      }, 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return digit(12) === Number(cnpj[12]) && digit(13) === Number(cnpj[13]);
}

function isValidEmail(email: string): boolean {
  const at = email.indexOf("@");
  return at > 0 && at === email.lastIndexOf("@") && email.slice(at + 1).length > 0;
}

export function validatePreAccessInput(input: NormalizedInput): PreAccessErrorCode | null {
  if (input.cnpj.length > MAX_FIELD_LEN || !isValidCnpj(input.cnpj)) return "INVALID_CNPJ";
  if (input.whatsapp.length > MAX_FIELD_LEN || !/^55\d{10,11}$/.test(input.whatsapp)) {
    return "INVALID_WHATSAPP";
  }
  if ((input.email?.length ?? 0) > MAX_FIELD_LEN || (input.email !== null && !isValidEmail(input.email))) {
    return "INVALID_EMAIL";
  }
  return null;
}

async function assertUnderRateLimit(cnpj: string, ipHash: string | null): Promise<void> {
  const db = getHubServiceClient();
  await db.from("pre_access_attempts").insert({ cnpj, ip_hash: ipHash });
  const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  const { count, error } = await db
    .from("pre_access_attempts")
    .select("id", { count: "exact", head: true })
    .eq("cnpj", cnpj)
    .gte("created_at", since);
  if (error) throw new PreAccessError("UNAVAILABLE");
  if ((count ?? 0) > RATE_MAX) throw new PreAccessError("RATE_LIMITED");
}

export async function provisionBuyer(
  input: unknown,
  ctx: { ipHash?: string | null } = {},
): Promise<{ buyerId: string }> {
  const normalized = normalizePreAccessInput(input);
  const validationError = validatePreAccessInput(normalized);
  if (validationError) throw new PreAccessError(validationError);

  await assertUnderRateLimit(normalized.cnpj, ctx.ipHash ?? null);

  const db = getHubServiceClient();

  const { data: existing, error: readError } = await db
    .from("buyers")
    .select("id, whatsapp")
    .eq("cnpj", normalized.cnpj)
    .maybeSingle();
  if (readError) throw new PreAccessError("UNAVAILABLE");

  if (existing) {
    if (existing.whatsapp !== normalized.whatsapp) throw new PreAccessError("WHATSAPP_MISMATCH");
    const patch: Record<string, unknown> = { whatsapp: normalized.whatsapp };
    if (normalized.email !== null) patch.email = normalized.email;
    const { error: updateError } = await db.from("buyers").update(patch).eq("id", existing.id);
    if (updateError) throw new PreAccessError("UNAVAILABLE");
    return { buyerId: existing.id as string };
  }

  const { data: inserted, error: insertError } = await db
    .from("buyers")
    .insert({
      cnpj: normalized.cnpj,
      whatsapp: normalized.whatsapp,
      email: normalized.email,
      source: "landing",
    })
    .select("id")
    .single();
  if (insertError || !inserted) throw new PreAccessError("UNAVAILABLE");

  return { buyerId: inserted.id as string };
}
