// Validações e máscaras brasileiras puras: usadas no navegador (pop-up) e nos handlers.

export type Identity = { nome: string; whatsapp: string; cnpj: string | null };
export type IdentityField = "nome" | "whatsapp" | "cnpj";

const MIN_NAME = 2;
const MAX_NAME = 120;

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function isValidCnpj(cnpj: string): boolean {
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

// Mesmo formato gravado pelo pré-acesso do mypet: 55 + DDD + número.
export function normalizeWhatsapp(value: string): string | null {
  let digits = onlyDigits(value);
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) digits = digits.slice(2);
  return /^\d{10,11}$/.test(digits) ? `55${digits}` : null;
}

export function formatCnpj(value: string): string {
  const d = onlyDigits(value).slice(0, 14);
  let out = d.slice(0, 2);
  if (d.length > 2) out += `.${d.slice(2, 5)}`;
  if (d.length > 5) out += `.${d.slice(5, 8)}`;
  if (d.length > 8) out += `/${d.slice(8, 12)}`;
  if (d.length > 12) out += `-${d.slice(12, 14)}`;
  return out;
}

export function formatWhatsapp(value: string): string {
  let d = onlyDigits(value);
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  d = d.slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  const rest = d.slice(2);
  const cut = rest.length > 8 ? 5 : 4;
  return rest.length > cut ? `(${d.slice(0, 2)}) ${rest.slice(0, cut)}-${rest.slice(cut)}` : `(${d.slice(0, 2)}) ${rest}`;
}

export function validateIdentity(input: {
  nome?: unknown;
  whatsapp?: unknown;
  cnpj?: unknown;
}): { ok: true; value: Identity } | { ok: false; field: IdentityField; error: string } {
  const nome = typeof input.nome === "string" ? input.nome.trim() : "";
  if (nome.length < MIN_NAME) return { ok: false, field: "nome", error: "Informe seu nome." };
  if (nome.length > MAX_NAME) return { ok: false, field: "nome", error: "Nome muito longo." };

  const whatsapp = normalizeWhatsapp(typeof input.whatsapp === "string" ? input.whatsapp : "");
  if (!whatsapp) return { ok: false, field: "whatsapp", error: "Informe o WhatsApp com DDD." };

  const cnpjDigits = onlyDigits(typeof input.cnpj === "string" ? input.cnpj : "");
  if (cnpjDigits && !isValidCnpj(cnpjDigits)) return { ok: false, field: "cnpj", error: "CNPJ inválido." };

  return { ok: true, value: { nome, whatsapp, cnpj: cnpjDigits || null } };
}
