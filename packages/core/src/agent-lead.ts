// Nome e WhatsApp que o visitante informa no roteiro do /agente. Usado pelo
// navegador (antes de gravar no localStorage) e pelo servidor (antes de gravar
// na conversa): os dois aplicam a mesma regra.

export type AgentLead = { nome: string; whatsapp: string };

export const LEAD_NAME_MAX = 80;
export const LEAD_WHATSAPP_MAX = 40;

function oneLine(value: string, max: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, max).trim();
}

export function normalizeAgentLead(raw: unknown): AgentLead | null {
  if (!raw || typeof raw !== "object") return null;
  const { nome, whatsapp } = raw as Record<string, unknown>;
  if (typeof nome !== "string" || typeof whatsapp !== "string") return null;
  const cleanNome = oneLine(nome, LEAD_NAME_MAX);
  const cleanWhatsapp = oneLine(whatsapp, LEAD_WHATSAPP_MAX);
  if (!cleanNome || !cleanWhatsapp) return null;
  return { nome: cleanNome, whatsapp: cleanWhatsapp };
}
