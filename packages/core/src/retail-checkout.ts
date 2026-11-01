import { isValidCpf, normalizeWhatsapp, onlyDigits } from "./br-validation";

export type CheckoutLine = { id: string; qty: number };
export type CheckoutCustomer = { nome: string; cpf: string; email: string; whatsapp: string };
export type CheckoutAddress = {
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
};
export type CheckoutInput = {
  items: CheckoutLine[];
  customer: CheckoutCustomer;
  address: CheckoutAddress;
  shippingServiceId: number;
};
export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MAX_LINES = 100;
const MAX_QTY = 999;
const MAX_TEXT = 120;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function parseCheckoutLines(raw: unknown): ParseResult<CheckoutLine[]> {
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, error: "O carrinho está vazio." };
  if (raw.length > MAX_LINES) return { ok: false, error: "O carrinho tem itens demais." };
  const qtyById = new Map<string, number>();
  for (const line of raw) {
    const id = text((line as { id?: unknown })?.id);
    const qty = (line as { qty?: unknown })?.qty;
    if (!UUID_RE.test(id) || typeof qty !== "number" || !Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) {
      return { ok: false, error: "Algum item do carrinho é inválido." };
    }
    qtyById.set(id, (qtyById.get(id) ?? 0) + qty);
  }
  return { ok: true, value: [...qtyById].map(([id, qty]) => ({ id, qty })) };
}

export function parseCep(raw: unknown): ParseResult<string> {
  const cep = onlyDigits(text(raw));
  return /^\d{8}$/.test(cep) ? { ok: true, value: cep } : { ok: false, error: "Informe um CEP válido." };
}

export function parseCheckoutInput(body: unknown): ParseResult<CheckoutInput> {
  if (!body || typeof body !== "object") return { ok: false, error: "Pedido inválido." };
  const b = body as Record<string, unknown>;
  const c = (b.customer ?? {}) as Record<string, unknown>;
  const a = (b.address ?? {}) as Record<string, unknown>;

  const items = parseCheckoutLines(b.items);
  if (!items.ok) return items;

  const nome = text(c.nome);
  if (nome.length < 2 || nome.length > MAX_TEXT) return { ok: false, error: "Informe seu nome completo." };
  const cpf = onlyDigits(text(c.cpf));
  if (!isValidCpf(cpf)) return { ok: false, error: "Informe um CPF válido." };
  const email = text(c.email).toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > MAX_TEXT) return { ok: false, error: "Informe um e-mail válido." };
  const whatsapp = normalizeWhatsapp(text(c.whatsapp));
  if (!whatsapp) return { ok: false, error: "Informe um WhatsApp válido com DDD." };

  const cep = parseCep(a.cep);
  if (!cep.ok) return cep;
  const address = {
    cep: cep.value,
    logradouro: text(a.logradouro),
    numero: text(a.numero),
    complemento: text(a.complemento),
    bairro: text(a.bairro),
    cidade: text(a.cidade),
    uf: text(a.uf).toUpperCase(),
  };
  const required = [address.logradouro, address.numero, address.bairro, address.cidade];
  if (required.some((v) => !v || v.length > MAX_TEXT) || address.complemento.length > MAX_TEXT || !/^[A-Z]{2}$/.test(address.uf)) {
    return { ok: false, error: "Confira o endereço de entrega." };
  }

  const shippingServiceId = b.shippingServiceId;
  if (typeof shippingServiceId !== "number" || !Number.isInteger(shippingServiceId) || shippingServiceId < 1) {
    return { ok: false, error: "Escolha uma opção de frete." };
  }

  return { ok: true, value: { items: items.value, customer: { nome, cpf, email, whatsapp }, address, shippingServiceId } };
}
