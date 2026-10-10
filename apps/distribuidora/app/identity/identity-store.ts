import { useSyncExternalStore } from "react";
import type { Identity } from "@mypet/core/br-validation";

const STORAGE_KEY = "mypet_identity";
const EVENT = "mypet_identity_updated";

let cachedRaw: string | null | undefined;
let cached: Identity | null = null;
// Fallback quando o localStorage está bloqueado: sem ele o pop-up nunca fecharia.
let memory: Identity | null = null;

function parse(raw: string): Identity | null {
  try {
    const value = JSON.parse(raw) as Partial<Identity> | null;
    if (value && typeof value.nome === "string" && typeof value.whatsapp === "string") {
      return { nome: value.nome, whatsapp: value.whatsapp, cnpj: typeof value.cnpj === "string" ? value.cnpj : null };
    }
  } catch {
    // conteúdo corrompido: trata como sem identidade
  }
  return null;
}

export function readIdentity(): Identity | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cached = raw ? parse(raw) : null;
  }
  return cached ?? memory;
}

export function saveIdentity(identity: Identity): void {
  memory = identity;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  } catch {
    // segue só com a memória
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

// undefined no servidor e antes da hidratação: o pop-up só decide depois.
export function useIdentity(): Identity | null | undefined {
  return useSyncExternalStore<Identity | null | undefined>(subscribe, readIdentity, () => undefined);
}

export function __resetIdentityForTests(): void {
  cachedRaw = undefined;
  cached = null;
  memory = null;
}
