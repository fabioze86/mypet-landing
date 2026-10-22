// Portas do hub: as quatro entradas do cabeçalho de todas as páginas. Tabela
// e catálogo exigem cadastro; para o visitante elas levam ao cadastro e,
// depois dele, de volta à porta escolhida.

export type HubDoorId = "tabela" | "catalogo" | "agente" | "duvidas";

export type HubViewer = { kind: "visitante" } | { kind: "cliente"; displayName: string | null };

export type HubDoor = { id: HubDoorId; label: string; href: string; locked: boolean };

export const VISITANTE: HubViewer = { kind: "visitante" };

const DOORS: { id: HubDoorId; label: string; path: string; needsAccess: boolean }[] = [
  { id: "tabela", label: "Tabela de preços", path: "/pedido-rapido", needsAccess: true },
  { id: "catalogo", label: "Catálogo", path: "/catalogo", needsAccess: true },
  { id: "agente", label: "Agente", path: "/agente", needsAccess: false },
  { id: "duvidas", label: "Dúvidas", path: "/central-de-ajuda", needsAccess: false },
];

// destinos aceitos no ?next= do cadastro: só páginas do próprio hub, para o
// link não virar redirecionamento aberto
const NEXT_ALLOWED = ["/pedido-rapido", "/catalogo", "/agente", "/pedidos", "/cotacao"];

export function cadastroHref(next: string): string {
  return `/cadastro?next=${encodeURIComponent(next)}`;
}

export function safeNext(raw: string | string[] | null | undefined, fallback: string): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value && NEXT_ALLOWED.includes(value) ? value : fallback;
}

export function hubDoors(viewer: HubViewer): HubDoor[] {
  return DOORS.map(({ id, label, path, needsAccess }) => {
    const locked = needsAccess && viewer.kind === "visitante";
    return { id, label, href: locked ? cadastroHref(path) : path, locked };
  });
}

// nome de exibição: nome do cadastro, senão a empresa (mesma regra do /agente)
export function viewerFromBuyer(buyer: { nome?: string | null; empresa?: string | null } | null): HubViewer {
  if (!buyer) return VISITANTE;
  return { kind: "cliente", displayName: buyer.nome?.trim() || buyer.empresa?.trim() || null };
}
