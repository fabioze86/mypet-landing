# Hub My Pet, Fase 1: cabeçalho único com 4 portas — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer as páginas do `apps/mypet` parecerem um único hub. Todas passam a ter o mesmo cabeçalho, com as portas Tabela de preços, Catálogo, Agente e Dúvidas visíveis também para quem não tem cadastro. O cadastro mostra o que libera e devolve o visitante à porta que ele escolheu.

**Architecture:**
- **`HubNav`:** componente cliente que desenha o cabeçalho a partir de um `HubViewer` (visitante ou cliente).
- **Páginas públicas:** usam `HubHeaderSlot`, que lê o cookie dentro de um `Suspense`. A página continua pré-renderizada, com o cabeçalho de visitante como fallback.
- **Páginas do cliente:** já têm o comprador em mãos e passam o viewer direto.
- **Portas trancadas:** para o visitante, levam a `/cadastro?next=<porta>`. O `AccessForm` usa o `next` (só destinos de uma lista fixa) depois do cadastro.

**Tech Stack:** Next 16.3 (App Router, `cacheComponents: true`, `proxy.ts`), React 19.2, Vitest 4 + Testing Library, pnpm workspace (`@mypet/core`).

## Global Constraints

- **Copy:** não pode conter "atacado", "cotação" nem "loja" em texto visível (regra do projeto, há teste na home).
- **Travessão:** sem em-dash nem en-dash (`–`, `—`) na copy visível (há testes em `/cadastro` e no conteúdo).
- **Comentários de código:** em português, curtos, no estilo do arquivo vizinho.
- **`/loja` e `/balcao`:** continuam escondidos. Não remover o código nem as dependências deles (`/api/assistant`, `AssistantSearch`, `SiteNav` do core).
- **`SiteNav` do core:** é compartilhado com outros apps (`madpet` etc.). Não alterar; só deixar de usá-lo nas páginas do mypet tratadas aqui.
- **Comandos:** rodam a partir de `apps/mypet`. Testes: `pnpm test` (= `vitest run`). Tipos: `pnpm exec tsc --noEmit`.
- **Destinos aceitos em `?next=`:** apenas `/pedido-rapido`, `/catalogo`, `/agente`, `/pedidos`, `/cotacao`.
- **Fora desta fase** (Fases 2 a 4): vitrine sem preço da tabela, catálogo em duas versões e unificação das dúvidas. Nesta fase a porta trancada leva ao cadastro.

## Mapa de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `app/_components/hub/doors.ts` | criar | portas, `HubViewer`, `cadastroHref`, `safeNext`, `viewerFromBuyer` |
| `app/_components/hub/doors.test.ts` | criar | testes das regras acima |
| `app/_components/hub/use-logout.ts` | criar | logout extraído do `AgentShell` |
| `app/_components/hub/styles.ts` | criar | `HUB_STYLES` (cores próprias, serve para páginas `pa-*` e `ba-*`) |
| `app/_components/hub/hub-nav.tsx` | criar | cabeçalho do hub (cliente) |
| `app/_components/hub/hub-nav.test.tsx` | criar | visitante, cliente, Sair |
| `app/_components/hub/hub-header.tsx` | criar | `HubHeader` (servidor) e `HubHeaderSlot` (Suspense) |
| `app/_components/hub/hub-header.test.tsx` | criar | viewer a partir do cookie |
| `app/_components/hub/hub-footer.tsx` | criar | rodapé único das páginas públicas |
| `app/_components/hub/cadastro-unlocks.tsx` | criar | "O que o cadastro libera" |
| `app/_components/pre-access/access-form.tsx` | modificar | prop `nextFromUrl` |
| `app/_components/pre-access/styles.ts` | modificar | CSS de unlocks, links do rodapé e atalhos da ajuda; remove CSS de depoimentos |
| `app/page.tsx`, `app/cadastro/page.tsx`, `app/perguntas-frequentes/page.tsx`, `app/central-de-ajuda/**/page.tsx` | modificar | usar `HubHeaderSlot` + `HubFooter` |
| `app/agente/agent-shell.tsx`, `app/agente/styles.ts`, `app/agente/agent-chat.tsx` | modificar | usar `HubNav`, tirar logout próprio, linkar `/catalogo` |
| `app/pedido-rapido/page.tsx`, `app/cotacao/page.tsx`, `app/pedidos/page.tsx` | modificar | usar `HubNav`/`HubHeaderSlot` e redirecionar para o cadastro com `next` |
| `proxy.ts` | modificar | `/catalogo` anônimo vai para `/cadastro?next=%2Fcatalogo` |
| `app/_components/pre-access/quick-access-steps*.tsx`, `testimonials*.tsx` | apagar | código morto |
| `app/pre-access-content.ts` (+ teste) | modificar | remove `quickAccessSteps` e `testimonials` |

---

### Task 1: Regras das portas (`doors.ts`)

**Files:**
- Create: `apps/mypet/app/_components/hub/doors.ts`
- Test: `apps/mypet/app/_components/hub/doors.test.ts`

**Interfaces:**
- Produces:
  - `type HubDoorId = "tabela" | "catalogo" | "agente" | "duvidas"`
  - `type HubViewer = { kind: "visitante" } | { kind: "cliente"; displayName: string | null }`
  - `type HubDoor = { id: HubDoorId; label: string; href: string; locked: boolean }`
  - `const VISITANTE: HubViewer`
  - `hubDoors(viewer: HubViewer): HubDoor[]`
  - `cadastroHref(next: string): string`
  - `safeNext(raw: string | string[] | null | undefined, fallback: string): string`
  - `viewerFromBuyer(buyer: { nome?: string | null; empresa?: string | null } | null): HubViewer`

- [ ] **Step 1: Escrever o teste que falha**

```ts
// apps/mypet/app/_components/hub/doors.test.ts
import { describe, it, expect } from "vitest";
import { cadastroHref, hubDoors, safeNext, viewerFromBuyer, VISITANTE } from "./doors";

describe("hubDoors", () => {
  it("visitante: tabela e catálogo levam ao cadastro e voltam para a porta", () => {
    const doors = hubDoors(VISITANTE);
    expect(doors.map((d) => d.label)).toEqual(["Tabela de preços", "Catálogo", "Agente", "Dúvidas"]);
    expect(doors[0]).toMatchObject({ id: "tabela", href: "/cadastro?next=%2Fpedido-rapido", locked: true });
    expect(doors[1]).toMatchObject({ id: "catalogo", href: "/cadastro?next=%2Fcatalogo", locked: true });
    expect(doors[2]).toMatchObject({ id: "agente", href: "/agente", locked: false });
    expect(doors[3]).toMatchObject({ id: "duvidas", href: "/central-de-ajuda", locked: false });
  });

  it("cliente: todas as portas abertas", () => {
    const doors = hubDoors({ kind: "cliente", displayName: "Ana" });
    expect(doors.map((d) => d.href)).toEqual(["/pedido-rapido", "/catalogo", "/agente", "/central-de-ajuda"]);
    expect(doors.every((d) => !d.locked)).toBe(true);
  });
});

describe("cadastroHref", () => {
  it("codifica o destino no next", () => {
    expect(cadastroHref("/catalogo")).toBe("/cadastro?next=%2Fcatalogo");
  });
});

describe("safeNext", () => {
  it("aceita só destinos do hub", () => {
    expect(safeNext("/pedido-rapido", "/agente")).toBe("/pedido-rapido");
    expect(safeNext("/catalogo", "/agente")).toBe("/catalogo");
    expect(safeNext(["/pedidos", "/catalogo"], "/agente")).toBe("/pedidos");
  });

  it("usa o fallback para destino ausente, externo ou fora da lista", () => {
    for (const raw of [undefined, null, "", "https://evil.com", "//evil.com", "/loja", "/catalogo?x=1"]) {
      expect(safeNext(raw, "/agente")).toBe("/agente");
    }
  });
});

describe("viewerFromBuyer", () => {
  it("sem comprador é visitante", () => {
    expect(viewerFromBuyer(null)).toEqual({ kind: "visitante" });
  });

  it("usa o nome, senão a empresa, senão null", () => {
    expect(viewerFromBuyer({ nome: " Ana ", empresa: "Pet X" })).toEqual({ kind: "cliente", displayName: "Ana" });
    expect(viewerFromBuyer({ nome: "  ", empresa: "Pet X" })).toEqual({ kind: "cliente", displayName: "Pet X" });
    expect(viewerFromBuyer({ nome: null, empresa: null })).toEqual({ kind: "cliente", displayName: null });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm exec vitest run app/_components/hub/doors.test.ts`
Expected: FAIL com `Failed to resolve import "./doors"`.

- [ ] **Step 3: Implementar**

```ts
// apps/mypet/app/_components/hub/doors.ts

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
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm exec vitest run app/_components/hub/doors.test.ts`
Expected: PASS (8 testes).

- [ ] **Step 5: Commit**

```bash
git add apps/mypet/app/_components/hub/doors.ts apps/mypet/app/_components/hub/doors.test.ts
git commit -m "feat(hub): regras das portas do hub e do next do cadastro"
```

---

### Task 2: `HubNav` (cabeçalho) e logout compartilhado

**Files:**
- Create: `apps/mypet/app/_components/hub/use-logout.ts`
- Create: `apps/mypet/app/_components/hub/styles.ts`
- Create: `apps/mypet/app/_components/hub/hub-nav.tsx`
- Test: `apps/mypet/app/_components/hub/hub-nav.test.tsx`

**Interfaces:**
- Consumes (Task 1): `hubDoors`, `cadastroHref`, `HubDoorId`, `HubViewer`.
- Produces:
  - `HubNav(props: { viewer: HubViewer; current?: HubDoorId; inert?: boolean })`: renderiza `<header className="hub-header">`.
  - `useLogout(): { logout: () => Promise<void>; loggingOut: boolean; error: string | null }`
  - `LOGOUT_ERROR: string`
  - `HUB_STYLES: string`

Detalhe importante: só o bloco do cliente (`ClienteActions`) chama `useCart`/`useLogout`. Assim o cabeçalho de visitante não depende do `CartProvider`.

- [ ] **Step 1: Escrever o teste que falha**

```tsx
// apps/mypet/app/_components/hub/hub-nav.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

const cart = vi.hoisted(() => ({ items: [] as Array<{ qty: number }>, clear: vi.fn() }));
vi.mock("@mypet/core/components/cart-provider", () => ({
  useCart: () => ({ cart: { items: cart.items }, clear: cart.clear }),
}));
const nav = vi.hoisted(() => ({ goTo: vi.fn() }));
vi.mock("../../agente/navigate", () => ({ goTo: nav.goTo }));

import { HubNav } from "./hub-nav";

beforeEach(() => {
  cart.items = [{ qty: 2 }, { qty: 1 }];
  cart.clear.mockClear();
  nav.goTo.mockClear();
});
afterEach(() => vi.unstubAllGlobals());

describe("HubNav", () => {
  it("visitante: as 4 portas aparecem, tabela e catálogo com selo de cadastro", () => {
    render(<HubNav viewer={{ kind: "visitante" }} />);
    const portas = screen.getByRole("navigation", { name: "Hub My Pet" });
    expect(portas).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tabela de preços com cadastro" })).toHaveAttribute(
      "href",
      "/cadastro?next=%2Fpedido-rapido",
    );
    expect(screen.getByRole("link", { name: "Catálogo com cadastro" })).toHaveAttribute(
      "href",
      "/cadastro?next=%2Fcatalogo",
    );
    expect(screen.getByRole("link", { name: "Agente" })).toHaveAttribute("href", "/agente");
    expect(screen.getByRole("link", { name: "Dúvidas" })).toHaveAttribute("href", "/central-de-ajuda");
  });

  it("visitante: botão Abrir tabela leva ao cadastro e volta para a tabela, sem Sair", () => {
    render(<HubNav viewer={{ kind: "visitante" }} />);
    expect(screen.getByRole("link", { name: "Abrir tabela" })).toHaveAttribute("href", "/cadastro?next=%2Fpedido-rapido");
    expect(screen.queryByRole("button", { name: "Sair" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Meus pedidos" })).toBeNull();
  });

  it("marca a porta atual com aria-current", () => {
    render(<HubNav viewer={{ kind: "visitante" }} current="duvidas" />);
    expect(screen.getByRole("link", { name: "Dúvidas" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Agente" })).not.toHaveAttribute("aria-current");
  });

  it("cliente: portas abertas, Olá com o nome, pedidos, carrinho e Sair", () => {
    render(<HubNav viewer={{ kind: "cliente", displayName: "Ana" }} />);
    expect(screen.getByRole("link", { name: "Tabela de preços" })).toHaveAttribute("href", "/pedido-rapido");
    expect(screen.getByRole("link", { name: "Catálogo" })).toHaveAttribute("href", "/catalogo");
    expect(screen.getByText("Olá, Ana")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Meus pedidos" })).toHaveAttribute("href", "/pedidos");
    expect(screen.getByRole("link", { name: "Seu pedido (3)" })).toHaveAttribute("href", "/cotacao");
    expect(screen.getByRole("button", { name: "Sair" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Abrir tabela" })).toBeNull();
  });

  it("cliente sem nome: Olá!; carrinho vazio sem contador", () => {
    cart.items = [];
    render(<HubNav viewer={{ kind: "cliente", displayName: null }} />);
    expect(screen.getByText("Olá!")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Seu pedido" })).toBeInTheDocument();
  });

  it("inert vai para o header", () => {
    const { container } = render(<HubNav viewer={{ kind: "visitante" }} inert />);
    expect(container.querySelector("header.hub-header")).toHaveAttribute("inert");
  });

  it("Sair: chama /api/sair, limpa carrinho, conversa e lead e vai para a home", async () => {
    window.sessionStorage.setItem("mypet-agente-conversa", "{}");
    window.localStorage.setItem("mypet_agente_lead", "{}");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<HubNav viewer={{ kind: "cliente", displayName: "Ana" }} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Sair" }));
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/sair", expect.objectContaining({ method: "POST" }));
    expect(cart.clear).toHaveBeenCalled();
    expect(window.sessionStorage.getItem("mypet-agente-conversa")).toBeNull();
    expect(window.localStorage.getItem("mypet_agente_lead")).toBeNull();
    expect(nav.goTo).toHaveBeenCalledWith("/");
  });

  it("Sair com falha: mostra erro e não limpa nada", async () => {
    window.localStorage.setItem("mypet_agente_lead", "{}");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })));
    render(<HubNav viewer={{ kind: "cliente", displayName: "Ana" }} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Sair" }));
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível sair agora. Tente de novo.");
    expect(cart.clear).not.toHaveBeenCalled();
    expect(window.localStorage.getItem("mypet_agente_lead")).toBe("{}");
    expect(nav.goTo).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm exec vitest run app/_components/hub/hub-nav.test.tsx`
Expected: FAIL com `Failed to resolve import "./hub-nav"`.

- [ ] **Step 3: Implementar o logout (cópia fiel do que hoje está em `agent-shell.tsx:67-101`)**

```ts
// apps/mypet/app/_components/hub/use-logout.ts
"use client";

import { useCallback, useState } from "react";
import { useCart } from "@mypet/core/components/cart-provider";
import { AGENT_LEAD_STORAGE_KEY, AGENT_STORAGE_KEY } from "@mypet/core/agent-client";
import { goTo } from "../../agente/navigate";

export const LOGOUT_ERROR = "Não foi possível sair agora. Tente de novo.";

// Só limpa carrinho e conversa depois que o cookie foi apagado: se a rota
// falhar, o cliente continua logado com o pedido intacto.
export function useLogout() {
  const { clear: clearCart } = useCart();
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const logout = useCallback(async () => {
    setError(null);
    setLoggingOut(true);
    try {
      const res = await fetch("/api/sair", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
    } catch {
      setLoggingOut(false);
      setError(LOGOUT_ERROR);
      return;
    }
    clearCart();
    try {
      window.sessionStorage.removeItem(AGENT_STORAGE_KEY);
    } catch {
      // storage bloqueado: nada guardado para apagar
    }
    try {
      // o lead é dado pessoal: sair apaga o nome e o WhatsApp deste navegador
      window.localStorage.removeItem(AGENT_LEAD_STORAGE_KEY);
    } catch {
      // storage bloqueado: nada guardado para apagar
    }
    goTo("/");
  }, [clearCart]);

  return { logout, loggingOut, error };
}
```

- [ ] **Step 4: Implementar os estilos**

```ts
// apps/mypet/app/_components/hub/styles.ts

// Cabeçalho do hub. Cores próprias porque ele aparece tanto nas páginas da
// landing (pa-*) quanto nas do cliente (ba-*). No celular as portas descem
// para uma segunda linha com rolagem lateral, para nunca sumirem.
export const HUB_STYLES = `
  .hub-header {
    --hub-navy: #1A3472; --hub-green: #00A651; --hub-green-dark: #068A47;
    --hub-muted: #5A6580; --hub-line: #DDE2EC; --hub-soft: #EDF0F8;
    position: sticky; top: 0; z-index: 50;
    background: rgba(255,255,255,0.95); backdrop-filter: saturate(180%) blur(8px);
    border-bottom: 1px solid var(--hub-line);
    font-family: var(--font-geist), system-ui, sans-serif;
  }
  .hub-row {
    position: relative; max-width: 1180px; margin: 0 auto; padding: 0 24px; min-height: 64px;
    display: grid; grid-template-columns: auto 1fr auto; grid-template-areas: "brand doors actions";
    align-items: center; gap: 8px 24px;
  }
  .hub-brand { grid-area: brand; display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 17px; color: var(--hub-navy); text-decoration: none; white-space: nowrap; }
  .hub-doors { grid-area: doors; display: flex; gap: 4px; justify-content: center; }
  .hub-door { display: inline-flex; align-items: center; gap: 6px; padding: 8px 12px; border-radius: 999px; color: var(--hub-muted); font-weight: 500; font-size: 14px; text-decoration: none; white-space: nowrap; }
  .hub-door:hover { color: var(--hub-navy); background: #F0F2F6; }
  .hub-door[aria-current="page"] { color: var(--hub-navy); font-weight: 600; background: var(--hub-soft); }
  .hub-lock { font-size: 11px; font-weight: 600; color: var(--hub-green-dark); background: #E3F5EC; padding: 2px 8px; border-radius: 999px; }
  .hub-actions { grid-area: actions; display: flex; align-items: center; justify-content: flex-end; gap: 14px; }
  .hub-actions a { color: var(--hub-muted); font-size: 14px; font-weight: 500; text-decoration: none; white-space: nowrap; }
  .hub-actions a:hover { color: var(--hub-navy); }
  .hub-actions a.hub-cta { color: #fff; background: var(--hub-green); padding: 8px 16px; border-radius: 999px; font-weight: 600; }
  .hub-actions a.hub-cta:hover { background: var(--hub-green-dark); color: #fff; }
  .hub-hello { font-size: 14px; font-weight: 600; color: var(--hub-navy); white-space: nowrap; }
  .hub-logout { background: none; border: 1px solid var(--hub-line); border-radius: 999px; padding: 6px 14px; font: inherit; font-size: 14px; color: var(--hub-muted); cursor: pointer; }
  .hub-logout:hover { color: var(--hub-navy); border-color: var(--hub-navy); }
  .hub-logout:disabled { opacity: .6; cursor: default; }
  .hub-logout-error { position: absolute; right: 24px; top: 100%; margin: 4px 0 0; padding: 6px 12px; background: #FFF4E5; color: #B35C00; border-radius: 8px; font-size: 13px; }
  @media (max-width: 900px) {
    .hub-row { grid-template-columns: 1fr auto; grid-template-areas: "brand actions" "doors doors"; padding: 8px 16px 0; min-height: 0; }
    .hub-doors { justify-content: flex-start; overflow-x: auto; margin: 0 -16px; padding: 0 16px 8px; scrollbar-width: none; }
    .hub-doors::-webkit-scrollbar { display: none; }
    .hub-hello { display: none; }
    .hub-logout-error { right: 16px; }
  }
  @media (max-width: 420px) {
    .hub-brand-name { display: none; }
    .hub-actions { gap: 10px; }
  }
`;
```

- [ ] **Step 5: Implementar o `HubNav`**

```tsx
// apps/mypet/app/_components/hub/hub-nav.tsx
"use client";

import { useCart } from "@mypet/core/components/cart-provider";
import { clientConfig } from "@/client.config";
import { cadastroHref, hubDoors, type HubDoorId, type HubViewer } from "./doors";
import { HUB_STYLES } from "./styles";
import { useLogout } from "./use-logout";

const { name: SITE_NAME, logo } = clientConfig;

// Cabeçalho único do hub: as quatro portas aparecem para todos. Para o
// visitante, tabela e catálogo levam o selo "com cadastro".
export function HubNav({ viewer, current, inert }: { viewer: HubViewer; current?: HubDoorId; inert?: boolean }) {
  return (
    <header className="hub-header" inert={inert}>
      <style>{HUB_STYLES}</style>
      <div className="hub-row">
        <a href={viewer.kind === "cliente" ? "/agente" : "/"} className="hub-brand">
          <span aria-hidden>{logo.emoji}</span>
          <span className="hub-brand-name">{SITE_NAME}</span>
        </a>
        <nav className="hub-doors" aria-label="Hub My Pet">
          {hubDoors(viewer).map((door) => (
            <a
              key={door.id}
              href={door.href}
              className="hub-door"
              aria-current={door.id === current ? "page" : undefined}
            >
              {door.label}
              {door.locked && (
                <>
                  {" "}
                  <span className="hub-lock">com cadastro</span>
                </>
              )}
            </a>
          ))}
        </nav>
        {viewer.kind === "cliente" ? (
          <ClienteActions displayName={viewer.displayName} />
        ) : (
          <div className="hub-actions">
            <a href={cadastroHref("/pedido-rapido")} className="hub-cta">
              Abrir tabela
            </a>
          </div>
        )}
      </div>
    </header>
  );
}

// só o cliente usa carrinho e logout: o cabeçalho do visitante não depende do CartProvider
function ClienteActions({ displayName }: { displayName: string | null }) {
  const { cart } = useCart();
  const { logout, loggingOut, error } = useLogout();
  const count = cart.items.reduce((sum, item) => sum + item.qty, 0);
  return (
    <div className="hub-actions">
      <span className="hub-hello">{displayName ? `Olá, ${displayName}` : "Olá!"}</span>
      <a href="/pedidos">Meus pedidos</a>
      <a href="/cotacao">Seu pedido{count > 0 ? ` (${count})` : ""}</a>
      <button type="button" className="hub-logout" onClick={logout} disabled={loggingOut}>
        Sair
      </button>
      {error && (
        <p className="hub-logout-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `pnpm exec vitest run app/_components/hub/hub-nav.test.tsx`
Expected: PASS (8 testes).

- [ ] **Step 7: Commit**

```bash
git add apps/mypet/app/_components/hub/use-logout.ts apps/mypet/app/_components/hub/styles.ts apps/mypet/app/_components/hub/hub-nav.tsx apps/mypet/app/_components/hub/hub-nav.test.tsx
git commit -m "feat(hub): cabeçalho único com as 4 portas para visitante e cliente"
```

---

### Task 3: `HubHeaderSlot` (páginas públicas) e `HubFooter`

**Files:**
- Create: `apps/mypet/app/_components/hub/hub-header.tsx`
- Create: `apps/mypet/app/_components/hub/hub-footer.tsx`
- Modify: `apps/mypet/app/_components/pre-access/styles.ts` (CSS de `.pa-footer-links`)
- Test: `apps/mypet/app/_components/hub/hub-header.test.tsx`

**Interfaces:**
- Consumes: `HubNav` (Task 2); `VISITANTE`, `viewerFromBuyer`, `HubDoorId` (Task 1); `requireBuyer()` de `@/lib/require-buyer` (`Promise<Buyer | null>`).
- Produces:
  - `HubHeader(props: { current?: HubDoorId }): Promise<JSX.Element>` (servidor, lê o cookie)
  - `HubHeaderSlot(props: { current?: HubDoorId })`: `Suspense` com fallback de visitante
  - `HubFooter()`: rodapé `pa-footer` com links "Central de ajuda" e "mypetbrasil.com"

- [ ] **Step 1: Ler a doc do Next sobre `cacheComponents` e dados dinâmicos**

Run: `grep -ril "cacheComponents" ../../node_modules/next/dist/docs/ | head`. Leia o guia de Cache Components que aparecer.
Confirmar: ler `cookies()` dentro de um componente envolto em `<Suspense>` mantém o resto da página pré-renderizado. É o mesmo padrão que `/agente` e `/pedido-rapido` já usam com `requireBuyer`. Se a doc disser algo diferente, ajuste o `HubHeaderSlot` antes de seguir.

- [ ] **Step 2: Escrever o teste que falha**

```tsx
// apps/mypet/app/_components/hub/hub-header.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const requireBuyer = vi.fn();
vi.mock("@/lib/require-buyer", () => ({ requireBuyer: () => requireBuyer() }));
vi.mock("@mypet/core/components/cart-provider", () => ({
  useCart: () => ({ cart: { items: [] }, clear: vi.fn() }),
}));
vi.mock("../../agente/navigate", () => ({ goTo: vi.fn() }));

import { HubHeader } from "./hub-header";
import { HubFooter } from "./hub-footer";

beforeEach(() => requireBuyer.mockReset());

describe("HubHeader", () => {
  it("sem cookie: cabeçalho de visitante", async () => {
    requireBuyer.mockResolvedValue(null);
    render(await HubHeader({ current: "duvidas" }));
    expect(screen.getByRole("link", { name: "Abrir tabela" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dúvidas" })).toHaveAttribute("aria-current", "page");
  });

  it("com comprador: cabeçalho de cliente com o nome", async () => {
    requireBuyer.mockResolvedValue({ id: "b1", nome: "Ana", empresa: "Pet X" });
    render(await HubHeader({}));
    expect(screen.getByText("Olá, Ana")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tabela de preços" })).toHaveAttribute("href", "/pedido-rapido");
  });
});

describe("HubFooter", () => {
  it("linka a central de ajuda e o site oficial", () => {
    render(<HubFooter />);
    expect(screen.getByRole("link", { name: "Central de ajuda" })).toHaveAttribute("href", "/central-de-ajuda");
    expect(screen.getByRole("link", { name: "mypetbrasil.com" })).toHaveAttribute("href", "https://www.mypetbrasil.com");
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `pnpm exec vitest run app/_components/hub/hub-header.test.tsx`
Expected: FAIL com `Failed to resolve import "./hub-header"`.

- [ ] **Step 4: Implementar**

```tsx
// apps/mypet/app/_components/hub/hub-header.tsx
import { Suspense } from "react";
import { requireBuyer } from "@/lib/require-buyer";
import { VISITANTE, viewerFromBuyer, type HubDoorId } from "./doors";
import { HubNav } from "./hub-nav";

// Cabeçalho das páginas públicas. O cookie só é lido dentro do Suspense, então
// a página continua pré-renderizada; até o cliente ser identificado aparece o
// cabeçalho de visitante.
export async function HubHeader({ current }: { current?: HubDoorId }) {
  const buyer = await requireBuyer();
  return <HubNav viewer={viewerFromBuyer(buyer)} current={current} />;
}

export function HubHeaderSlot({ current }: { current?: HubDoorId }) {
  return (
    <Suspense fallback={<HubNav viewer={VISITANTE} current={current} />}>
      <HubHeader current={current} />
    </Suspense>
  );
}
```

```tsx
// apps/mypet/app/_components/hub/hub-footer.tsx
import { clientConfig } from "@/client.config";
import { OFFICIAL_SITE_URL } from "../../pre-access-content";

const { name: SITE_NAME, tagline: TAGLINE, logo } = clientConfig;

// Rodapé único das páginas públicas (home, cadastro, dúvidas).
export function HubFooter() {
  return (
    <footer className="pa-footer">
      <div className="pa-wrap pa-footer-row">
        <div className="pa-footer-brand">
          <span aria-hidden>{logo.emoji}</span>
          <span>{SITE_NAME} - {TAGLINE}</span>
        </div>
        <nav className="pa-footer-links" aria-label="Links do rodapé">
          <a href="/central-de-ajuda">Central de ajuda</a>
          <a href={OFFICIAL_SITE_URL} target="_blank" rel="noopener noreferrer">mypetbrasil.com</a>
        </nav>
        <small>
          © {SITE_NAME}. Dados de CNPJ e WhatsApp usados apenas para liberar a tabela de preços.
          {" "}Desenvolvido por{" "}
          <a
            href="https://www.zemann.com.br"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "inherit", textDecoration: "underline" }}
          >
            Zemann.ai
          </a>
        </small>
      </div>
    </footer>
  );
}
```

Em `apps/mypet/app/_components/pre-access/styles.ts`, adicionar logo depois da linha `.pa-footer small { … }`:

```css
  .pa-footer-links { display: flex; gap: 18px; }
  .pa-footer-links a { color: rgba(255,255,255,0.82); font-size: 13px; text-decoration: none; }
  .pa-footer-links a:hover { color: #fff; text-decoration: underline; }
```

- [ ] **Step 5: Rodar e ver passar**

Run: `pnpm exec vitest run app/_components/hub/hub-header.test.tsx`
Expected: PASS (3 testes). Se `OFFICIAL_SITE_URL` não for `https://www.mypetbrasil.com`, use o valor real no teste. O teste da home (`app/page.test.tsx`) já fixa esse valor.

- [ ] **Step 6: Commit**

```bash
git add apps/mypet/app/_components/hub/hub-header.tsx apps/mypet/app/_components/hub/hub-footer.tsx apps/mypet/app/_components/hub/hub-header.test.tsx apps/mypet/app/_components/pre-access/styles.ts
git commit -m "feat(hub): cabeçalho com cookie em Suspense e rodapé único das páginas públicas"
```

---

### Task 4: Cadastro mostra o que libera e volta para a porta escolhida

**Files:**
- Create: `apps/mypet/app/_components/hub/cadastro-unlocks.tsx`
- Modify: `apps/mypet/app/_components/pre-access/access-form.tsx:9-12,40-42`
- Modify: `apps/mypet/app/_components/pre-access/styles.ts` (CSS `.hub-unlocks`)
- Modify: `apps/mypet/app/cadastro/page.tsx`
- Test: `apps/mypet/app/_components/pre-access/access-form.test.tsx`, `apps/mypet/app/cadastro/page.test.tsx`

**Interfaces:**
- Consumes: `safeNext` (Task 1), `HubHeaderSlot`, `HubFooter` (Task 3).
- Produces:
  - `AccessForm` ganha a prop `nextFromUrl?: boolean` (padrão `false`). Quando `true`, depois do cadastro vai para `safeNext(?next, redirectTo)`.
  - `CadastroUnlocks()` e `CADASTRO_UNLOCKS`.

- [ ] **Step 1: Escrever os testes que falham**

No fim do `describe("AccessForm")` em `access-form.test.tsx`, acrescentar:

```tsx
  it("com nextFromUrl, vai para o next da URL quando ele é do hub", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    Object.defineProperty(window, "location", { value: { assign, search: "?next=%2Fcatalogo" }, writable: true });
    const user = userEvent.setup();
    render(<AccessForm nextFromUrl />);

    await user.type(screen.getByLabelText("CNPJ"), "12.345.678/0001-95");
    await user.type(screen.getByLabelText("WhatsApp"), "(11) 99999-0000");
    await user.click(screen.getByRole("button", { name: "Consultar preços" }));

    expect(assign).toHaveBeenCalledWith("/catalogo");
  });

  it("com nextFromUrl, ignora next externo e usa o redirectTo", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    Object.defineProperty(window, "location", {
      value: { assign, search: "?next=https%3A%2F%2Fevil.com" },
      writable: true,
    });
    const user = userEvent.setup();
    render(<AccessForm nextFromUrl />);

    await user.type(screen.getByLabelText("CNPJ"), "12.345.678/0001-95");
    await user.type(screen.getByLabelText("WhatsApp"), "(11) 99999-0000");
    await user.click(screen.getByRole("button", { name: "Consultar preços" }));

    expect(assign).toHaveBeenCalledWith("/agente");
  });
```

Substituir `apps/mypet/app/cadastro/page.test.tsx` por:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("../_components/hub/hub-header", () => ({ HubHeaderSlot: () => <header data-testid="hub-header" /> }));

import CadastroPage from "./page";

describe("CadastroPage", () => {
  it("mostra o formulário de criação de acesso", () => {
    render(<CadastroPage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/preços/i);
    expect(screen.getByRole("heading", { level: 2, name: "Liberar tabela" })).toBeInTheDocument();
    expect(screen.getByLabelText("CNPJ")).toBeInTheDocument();
    expect(screen.getByLabelText("WhatsApp")).toBeInTheDocument();
  });

  it("usa o cabeçalho do hub", () => {
    render(<CadastroPage />);
    expect(screen.getByTestId("hub-header")).toBeInTheDocument();
  });

  it("lista o que o cadastro libera", () => {
    render(<CadastroPage />);
    const lista = screen.getByRole("region", { name: "O que o cadastro libera" });
    for (const item of ["Tabela de preços completa", "Catálogo com preços", "Agente My Pet completo", "Pedido pelo WhatsApp"]) {
      expect(lista).toHaveTextContent(item);
    }
  });

  it("tem um único h1", () => {
    render(<CadastroPage />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("não tem em-dash nem palavras proibidas na copy visível", () => {
    const { container } = render(<CadastroPage />);
    expect(container.textContent ?? "").not.toMatch(/[–—]/);
    expect(container.textContent ?? "").not.toMatch(/atacado|cota[cç][aã]o|\bloja\b/i);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm exec vitest run app/_components/pre-access/access-form.test.tsx app/cadastro/page.test.tsx`
Expected: FAIL. O teste do `/catalogo` recebe `"/agente"`, e "lista o que o cadastro libera" não acha a região.

- [ ] **Step 3: Implementar o `nextFromUrl` no `AccessForm`**

No topo de `access-form.tsx`, junto dos imports:

```tsx
import { safeNext } from "../hub/doors";
```

Trocar a assinatura:

```tsx
export function AccessForm({
  submitLabel = "Consultar preços",
  redirectTo = "/agente",
  nextFromUrl = false,
}: { submitLabel?: string; redirectTo?: string; nextFromUrl?: boolean } = {}) {
```

Trocar o bloco `if (response.ok) { … }`:

```tsx
      if (response.ok) {
        // no /cadastro o destino vem do ?next= (a porta do hub que o visitante escolheu)
        const target = nextFromUrl
          ? safeNext(new URLSearchParams(window.location.search).get("next"), redirectTo)
          : redirectTo;
        window.location.assign(target);
        return;
      }
```

- [ ] **Step 4: Criar a lista do que o cadastro libera**

```tsx
// apps/mypet/app/_components/hub/cadastro-unlocks.tsx

// O que o cadastro libera: o visitante vê o que ganha antes de informar CNPJ
// e WhatsApp.
export const CADASTRO_UNLOCKS = [
  {
    title: "Tabela de preços completa",
    body: "Todos os itens com os mesmos preços do mypetbrasil.com, com busca por nome, SKU, categoria ou marca.",
  },
  { title: "Catálogo com preços", body: "Fotos e preços de cada categoria, para consultar quando quiser." },
  { title: "Agente My Pet completo", body: "Encontra produtos, mostra os preços e monta o pedido com você." },
  { title: "Pedido pelo WhatsApp", body: "Monte o pedido na tabela ou no agente e envie pronto para o nosso time." },
] as const;

export function CadastroUnlocks() {
  return (
    <section className="hub-unlocks" aria-labelledby="hub-unlocks-title">
      <h2 id="hub-unlocks-title">O que o cadastro libera</h2>
      <ul>
        {CADASTRO_UNLOCKS.map((item) => (
          <li key={item.title}>
            <strong>{item.title}</strong>
            <span>{item.body}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

Em `pre-access/styles.ts`, adicionar antes do fechamento `` `; `` do `LANDING_STYLES`:

```css
  /* hub: o que o cadastro libera */
  .hub-unlocks { margin-top: 24px; }
  .hub-unlocks h2 { font-family: var(--pa-geist); font-weight: 600; font-size: 15px; color: var(--pa-navy); margin: 0 0 10px; }
  .hub-unlocks ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
  .hub-unlocks li { padding-left: 26px; position: relative; font-size: 14px; color: var(--pa-muted); line-height: 1.5; }
  .hub-unlocks li::before { content: "✓"; position: absolute; left: 0; top: 0; color: var(--pa-green); font-weight: 700; }
  .hub-unlocks strong { display: block; color: var(--pa-navy); font-weight: 600; }
```

- [ ] **Step 5: Aplicar na página `/cadastro`**

Substituir `apps/mypet/app/cadastro/page.tsx` por:

```tsx
import type { Metadata } from "next";
import { canonicalUrl } from "@mypet/core/seo";
import { clientConfig } from "@/client.config";
import { AccessForm } from "../_components/pre-access/access-form";
import { LANDING_STYLES } from "../_components/pre-access/styles";
import { HubHeaderSlot } from "../_components/hub/hub-header";
import { HubFooter } from "../_components/hub/hub-footer";
import { CadastroUnlocks } from "../_components/hub/cadastro-unlocks";

const { name: SITE_NAME } = clientConfig;

export function generateMetadata(): Metadata {
  return {
    title: `Liberar tabela de preços - ${SITE_NAME}`,
    description:
      "Informe CNPJ e WhatsApp para liberar a tabela de preços da My Pet Brasil, com os mesmos preços do mypetbrasil.com.",
    alternates: { canonical: canonicalUrl(clientConfig.domain, "/cadastro") },
  };
}

export default function CadastroPage() {
  return (
    <>
      <style>{LANDING_STYLES}</style>
      <HubHeaderSlot />

      <main>
        <section className="pa-cadastro-section" aria-labelledby="cadastro-title">
          <div className="pa-wrap pa-cadastro-wrap">
            <div className="pa-cadastro-intro">
              <p className="pa-eyebrow">Tabela de Preços My Pet Brasil</p>
              <h1 id="cadastro-title">Libere a tabela de preços</h1>
              <p>
                Informe os dados básicos da sua empresa para ver os preços, montar seu pedido e enviá-lo pelo WhatsApp.
              </p>
              <CadastroUnlocks />
            </div>

            <div className="pa-panel" id="acesso">
              <h2>Liberar tabela</h2>
              <p className="pa-panel-sub">Faça uma identificação rápida para consultar os preços da My Pet Brasil.</p>
              <AccessForm nextFromUrl />
            </div>
          </div>
        </section>
      </main>

      <HubFooter />
    </>
  );
}
```

Antes de salvar, confira com `git diff` que o miolo (`<section>…</section>`) ficou igual ao original, mudando só o `<CadastroUnlocks />` e o `nextFromUrl`. Se o arquivo original tiver algo entre `</section>` e `</main>` que não aparece aqui, mantenha.

- [ ] **Step 6: Rodar e ver passar**

Run: `pnpm exec vitest run app/_components/pre-access/access-form.test.tsx app/cadastro/page.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/mypet/app/_components/hub/cadastro-unlocks.tsx apps/mypet/app/_components/pre-access/access-form.tsx apps/mypet/app/_components/pre-access/access-form.test.tsx apps/mypet/app/_components/pre-access/styles.ts apps/mypet/app/cadastro/page.tsx apps/mypet/app/cadastro/page.test.tsx
git commit -m "feat(cadastro): mostra o que o cadastro libera e volta para a porta escolhida"
```

---

### Task 5: Home, perguntas frequentes e central de ajuda com o cabeçalho do hub

**Files:**
- Modify: `apps/mypet/app/page.tsx`
- Modify: `apps/mypet/app/perguntas-frequentes/page.tsx`
- Modify: `apps/mypet/app/central-de-ajuda/page.tsx`
- Modify: `apps/mypet/app/central-de-ajuda/c/[categoriaSlug]/page.tsx`
- Modify: `apps/mypet/app/central-de-ajuda/a/[artigoSlug]/page.tsx`
- Modify: `apps/mypet/app/central-de-ajuda/busca/page.tsx`
- Modify: `apps/mypet/app/_components/pre-access/styles.ts` (CSS `.pa-help-quick`)
- Test: `apps/mypet/app/page.test.tsx`, `apps/mypet/app/central-de-ajuda/page.test.tsx`

**Interfaces:**
- Consumes: `HubHeaderSlot`, `HubFooter` (Task 3).

- [ ] **Step 1: Escrever os testes que falham**

Em `app/page.test.tsx`, logo depois dos `vi.mock` existentes:

```tsx
vi.mock("./_components/hub/hub-header", () => ({ HubHeaderSlot: () => <header data-testid="hub-header" /> }));
```

E dentro do `describe("LandingPage")`:

```tsx
  it("usa o cabeçalho e o rodapé do hub", async () => {
    render(await LandingPage());
    expect(screen.getByTestId("hub-header")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Central de ajuda" })).toHaveAttribute("href", "/central-de-ajuda");
  });
```

Em `app/central-de-ajuda/page.test.tsx`, depois do `vi.mock` existente:

```tsx
vi.mock("../_components/hub/hub-header", () => ({
  HubHeaderSlot: ({ current }: { current?: string }) => <header data-testid="hub-header" data-current={current} />,
}));
```

E no `describe`:

```tsx
  it("usa o cabeçalho do hub com Dúvidas marcada e tem busca na página", async () => {
    render(await CentralDeAjudaPage());
    expect(screen.getByTestId("hub-header")).toHaveAttribute("data-current", "duvidas");
    expect(screen.getByRole("searchbox")).toHaveAttribute("name", "q");
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm exec vitest run app/page.test.tsx app/central-de-ajuda/page.test.tsx`
Expected: FAIL. Não há `hub-header` nem link "Central de ajuda" na home, nem `searchbox` na central.

- [ ] **Step 3: Home (`app/page.tsx`)**

- **Cabeçalho:** trocar todo o bloco `<header className="pa-header">…</header>` por `<HubHeaderSlot />`.
- **Rodapé:** trocar todo o bloco `<footer className="pa-footer">…</footer>` por `<HubFooter />`.
- **Imports:** adicionar os dois abaixo e remover os que ficarem sem uso: `OFFICIAL_SITE_URL` e a desestruturação `{ name: SITE_NAME, tagline: TAGLINE, logo }`. Mantenha `SITE_NAME` se o `generateMetadata` usar.

```tsx
import { HubHeaderSlot } from "./_components/hub/hub-header";
import { HubFooter } from "./_components/hub/hub-footer";
```

O `return` fica:

```tsx
  return (
    <>
      <style>{LANDING_STYLES}</style>
      <HubHeaderSlot />

      <main>
        <Hero />
        <WhyBuy />
        <HowItWorks />
        <CommercialFaq />
        <CommercialConditions />
        <CatalogPreview categories={topCategories} thumbs={thumbs} />
        <ClosingCta />
      </main>

      <HubFooter />
    </>
  );
```

Os atalhos internos (`#como-funciona`, `#faq`, `#condicoes`, `#categorias`) saem do menu de propósito: as portas tomam o lugar deles. O link `mypetbrasil.com` passa para o rodapé, e o teste "linka o site oficial" continua achando um único link com esse nome.

- [ ] **Step 4: Perguntas frequentes (`app/perguntas-frequentes/page.tsx`)**

- **Cabeçalho:** trocar o `<header className="pa-header">…</header>` por `<HubHeaderSlot current="duvidas" />`.
- **Rodapé:** trocar o `<footer className="pa-footer">…</footer>` por `<HubFooter />`.
- **Imports:** adicionar os dois abaixo e reduzir a desestruturação para `const { name: SITE_NAME } = clientConfig;`.

```tsx
import { HubHeaderSlot } from "../_components/hub/hub-header";
import { HubFooter } from "../_components/hub/hub-footer";
```

- [ ] **Step 5: Central de ajuda, índice (`app/central-de-ajuda/page.tsx`)**

- **Cabeçalho:** trocar o `<header className="pa-header">…</header>` por `<HubHeaderSlot current="duvidas" />`.
- **Rodapé:** trocar o `<footer className="pa-footer">…</footer>` por `<HubFooter />`.
- **Imports:** os mesmos do Step 4, com caminho `../_components/hub/...`. Reduzir para `const { name: SITE_NAME } = clientConfig;`.
- **Busca:** a busca sai do cabeçalho e entra na página. Logo depois do `<p className="pa-sec-lead">…</p>`, adicionar:

```tsx
            <form action="/central-de-ajuda/busca" method="get" className="pa-help-search" style={{ marginTop: 20 }}>
              <input type="search" name="q" aria-label="Buscar uma dúvida" placeholder="Ex.: pedido mínimo, Pix, prazo de entrega" />
              <button type="submit">Buscar</button>
            </form>
```

- [ ] **Step 6: Central de ajuda, categoria (`app/central-de-ajuda/c/[categoriaSlug]/page.tsx`)**

- **Cabeçalho:** trocar o `<header className="pa-header">…</header>` por `<HubHeaderSlot current="duvidas" />`.
- **Rodapé:** trocar o `<footer className="pa-footer">…</footer>` por `<HubFooter />`.
- **Imports:** caminho `../../../_components/hub/...`. Remover `logo` da desestruturação.
- **Atalhos de categoria:** saem do cabeçalho e entram na página. Logo depois do `<Link href="/central-de-ajuda" className="pa-cadastro-back">…</Link>`, adicionar:

```tsx
            <nav className="pa-help-quick" aria-label="Categorias da central de ajuda">
              {linksRapidos.map((c) => (
                <Link
                  key={c.id}
                  href={`/central-de-ajuda/c/${c.slug}`}
                  aria-current={c.id === categoria.id ? "page" : undefined}
                >
                  {c.titulo}
                </Link>
              ))}
              <a href="/central-de-ajuda/busca">Buscar</a>
            </nav>
```

Em `pre-access/styles.ts`, adicionar depois das regras `.pa-help-search …`:

```css
  .pa-help-quick { display: flex; flex-wrap: wrap; gap: 8px 18px; margin-top: 14px; }
  .pa-help-quick a { color: var(--pa-muted); text-decoration: none; font-weight: 500; font-size: 14px; }
  .pa-help-quick a:hover, .pa-help-quick a[aria-current="page"] { color: var(--pa-navy); font-weight: 600; }
```

- [ ] **Step 7: Central de ajuda, artigo e busca**

Aplicar em `app/central-de-ajuda/a/[artigoSlug]/page.tsx` e `app/central-de-ajuda/busca/page.tsx`:
- **Cabeçalho:** trocar o `<header className="pa-header">…</header>` por `<HubHeaderSlot current="duvidas" />`.
- **Rodapé:** trocar o `<footer className="pa-footer">…</footer>` por `<HubFooter />`.
- **Imports:** caminhos `../../../_components/hub/...` (artigo) e `../../_components/hub/...` (busca). Remover `logo` da desestruturação.
- **Artigo:** o botão "Buscar" do cabeçalho some. O link "← Central de ajuda" do corpo continua.

- [ ] **Step 8: Rodar todos os testes destas páginas e os tipos**

Run: `pnpm exec vitest run app/page.test.tsx app/central-de-ajuda app/cadastro && pnpm exec tsc --noEmit`
Expected: PASS e `tsc` sem erros. Se o teste "linka o site oficial mypetbrasil.com" quebrar por haver dois links, procure o outro com `grep -rn "mypetbrasil.com" app/_components/pre-access` e confirme que só o rodapé tem um link com esse nome.

- [ ] **Step 9: Commit**

```bash
git add apps/mypet/app/page.tsx apps/mypet/app/page.test.tsx apps/mypet/app/perguntas-frequentes/page.tsx apps/mypet/app/central-de-ajuda apps/mypet/app/_components/pre-access/styles.ts
git commit -m "feat(hub): home, dúvidas e central de ajuda com o cabeçalho e o rodapé do hub"
```

---

### Task 6: `/agente` com o cabeçalho do hub

**Files:**
- Modify: `apps/mypet/app/agente/agent-shell.tsx:1-16,66-101,145-173`
- Modify: `apps/mypet/app/agente/styles.ts:3-10,123-125`
- Modify: `apps/mypet/app/agente/agent-chat.tsx:67`
- Test: `apps/mypet/app/agente/agent-shell.test.tsx`, `apps/mypet/app/agente/agent-chat.test.tsx`

**Interfaces:**
- Consumes: `HubNav` (Task 2), `VISITANTE` (Task 1). O `AgentShell` mantém as props `{ mode, initialQuestion, displayName }`, e `agente/page.tsx` não muda.

- [ ] **Step 1: Ajustar os testes**

Em `agent-shell.test.tsx`:
- **Teste "celular: com o painel aberto, cabeçalho, chat e rodapé ficam inert":** trocar `container.querySelector("header.pa-header")` por `container.querySelector("header.hub-header")`.
- **Testes de Sair:** remover "Sair: chama /api/sair, limpa carrinho e conversa e vai para a home" e "Sair com falha: mostra erro e não limpa nada". Eles agora vivem em `hub-nav.test.tsx` (Task 2).
- **Novo teste,** dentro do `describe`:

```tsx
  it("visitante: cabeçalho do hub com tabela e catálogo levando ao cadastro", () => {
    render(<AgentShell mode="visitante" initialQuestion={null} displayName={null} />);
    expect(screen.getByRole("link", { name: "Tabela de preços com cadastro" })).toHaveAttribute(
      "href",
      "/cadastro?next=%2Fpedido-rapido",
    );
    expect(screen.getByRole("link", { name: "Agente" })).toHaveAttribute("aria-current", "page");
  });
```

Os testes "cliente: links da tabela e dos pedidos", "Olá, Ana", "Olá!" e "visitante: sem Sair" ficam como estão. Eles passam a validar o `HubNav` dentro do shell. O mock de `@mypet/core/components/cart-provider` do arquivo já cobre o `useCart` do `HubNav`. O de `./navigate` também vale, porque é o mesmo módulo que `use-logout.ts` importa.

Em `agent-chat.test.tsx`, no teste "visitante: produtos sem preço, com convite ao cadastro":
- trocar o texto da mensagem em `assistantWithProducts` para `"Encontrei estas opções. Veja também /central-de-ajuda/a/frete e /catalogo."`;
- no fim do teste, acrescentar:

```tsx
    expect(screen.getByRole("link", { name: "/catalogo" })).toHaveAttribute("href", "/catalogo");
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm exec vitest run app/agente/agent-shell.test.tsx app/agente/agent-chat.test.tsx`
Expected: FAIL. Não existe `header.hub-header`, nem link "Tabela de preços com cadastro", nem link `/catalogo`.

- [ ] **Step 3: Trocar o cabeçalho do `AgentShell`**

Em `agent-shell.tsx`:
- **Remover:**
  - a constante `LOGOUT_ERROR`, a desestruturação `const { name: SITE_NAME, logo } = clientConfig;` e o import de `clientConfig`;
  - os imports de `AGENT_LEAD_STORAGE_KEY, AGENT_STORAGE_KEY` e de `goTo`;
  - de dentro do componente, `const { clear: clearCart } = useCart();`, os estados `loggingOut`/`logoutError` e todo o `handleLogout` (linhas 66-101).
- **Manter** o import de `useCart`, que o `CartBar` usa.
- **Adicionar:**

```tsx
import { HubNav } from "../_components/hub/hub-nav";
import { VISITANTE } from "../_components/hub/doors";
```

Trocar todo o bloco `<header className="pa-header" inert={sheetModal}> … </header>` (linhas 145-173) por:

```tsx
      <HubNav
        viewer={isVisitor ? VISITANTE : { kind: "cliente", displayName }}
        current="agente"
        inert={sheetModal}
      />
```

- [ ] **Step 4: Limpar o CSS que ficou sem uso**

Em `agente/styles.ts`, apagar:
- as regras `.ag-header-links`, `.ag-header-links a`, `.ag-header-links a:hover`, `.ag-hello`, `.ag-logout`, `.ag-logout:hover`, `.ag-logout:disabled` e `.ag-logout-error` (linhas 3-10);
- dentro da media query, `.ag-header-links a.ag-hide-mobile`, `.ag-header-links` e `.ag-hello` (linhas 123-125).

Depois, confirmar que nada mais usa essas classes:

Run: `grep -rn "ag-header-links\|ag-hello\|ag-logout\|ag-hide-mobile" app`
Expected: nenhuma saída.

- [ ] **Step 5: Linkar `/catalogo` nas respostas do agente**

Em `agent-chat.tsx:67`, trocar a regex por:

```ts
  /(?<![\w/.])(\/(?:central-de-ajuda(?:\/[a-z0-9-]+)*|cadastro|catalogo|perguntas-frequentes|pedido-rapido|pedidos))(?![\w-])/g;
```

- [ ] **Step 6: Rodar e ver passar**

Run: `pnpm exec vitest run app/agente && pnpm exec tsc --noEmit`
Expected: PASS e `tsc` sem erros.

- [ ] **Step 7: Commit**

```bash
git add apps/mypet/app/agente
git commit -m "feat(agente): cabeçalho do hub no /agente e link para o catálogo nas respostas"
```

---

### Task 7: Área do cliente com o cabeçalho do hub e redirecionamento para o cadastro com `next`

**Files:**
- Modify: `apps/mypet/app/pedido-rapido/page.tsx`
- Modify: `apps/mypet/app/cotacao/page.tsx`
- Modify: `apps/mypet/app/pedidos/page.tsx`
- Modify: `apps/mypet/proxy.ts`
- Test: `apps/mypet/app/pedido-rapido/page.test.tsx`, `apps/mypet/app/pedidos/page.test.tsx`, `apps/mypet/proxy.test.ts`

**Interfaces:**
- Consumes: `HubNav` (Task 2), `HubHeaderSlot` (Task 3), `cadastroHref`, `viewerFromBuyer` (Task 1).

- [ ] **Step 1: Ajustar os testes para o novo destino**

`app/pedido-rapido/page.test.tsx`: trocar o teste existente por

```tsx
  it("redireciona para o cadastro com volta para a tabela quando não há comprador", async () => {
    requireBuyer.mockResolvedValue(null);
    await expect(PedidoRapidoPageBody()).rejects.toThrow("REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/cadastro?next=%2Fpedido-rapido");
  });
```

`app/pedidos/page.test.tsx`: trocar o teste existente por

```tsx
  it("redireciona para o cadastro com volta para os pedidos quando não há comprador", async () => {
    requireBuyer.mockResolvedValue(null);

    await expect(PedidosContent()).rejects.toThrow("REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/cadastro?next=%2Fpedidos");
  });
```

`proxy.test.ts`: trocar o teste "redireciona o catálogo digital anônimo para /" por

```ts
  it("redireciona o catálogo digital anônimo para o cadastro com volta ao catálogo", async () => {
    for (const path of ["/catalogo", "/catalogo/index.html"]) {
      const res = await proxy(fakeRequest(`https://app.test${path}`));
      expect(res.headers.get("location")).toBe("https://app.test/cadastro?next=%2Fcatalogo");
    }
  });
```

O teste de `/loja` continua esperando `/`, porque a `/loja` segue escondida.

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm exec vitest run app/pedido-rapido/page.test.tsx app/pedidos/page.test.tsx proxy.test.ts`
Expected: FAIL nos três testes alterados (destinos antigos `/entrar`, `/` e `/`).

- [ ] **Step 3: `/pedido-rapido`**

Em `pedido-rapido/page.tsx`:
- **Imports:** remover o de `SiteNav` e adicionar:

```tsx
import { HubNav } from "../_components/hub/hub-nav";
import { cadastroHref, viewerFromBuyer } from "../_components/hub/doors";
```

- **Redirecionamento:** trocar `if (!buyer) redirect("/entrar");` por `if (!buyer) redirect(cadastroHref("/pedido-rapido"));`.
- **Cabeçalho:** trocar o bloco `<SiteNav … />` por `<HubNav viewer={viewerFromBuyer(buyer)} current="tabela" />`.
- **Categorias:** o `getCategories()` continua sendo usado pela tabela (`orderedCategories`).

- [ ] **Step 4: `/cotacao`**

Em `cotacao/page.tsx`:
- **Imports:** remover os de `SiteNav` e `getCategories` e adicionar:

```tsx
import { HubNav } from "../_components/hub/hub-nav";
import { cadastroHref, viewerFromBuyer } from "../_components/hub/doors";
```

- **Redirecionamento:** trocar `if (!buyer) redirect("/");` por `if (!buyer) redirect(cadastroHref("/cotacao"));`.
- **Categorias:** remover `const categories = await getCategories();`.
- **Cabeçalho:** trocar o bloco `<SiteNav … />` por `<HubNav viewer={viewerFromBuyer(buyer)} />`.

- [ ] **Step 5: `/pedidos`**

Em `pedidos/page.tsx`:
- **Imports:** remover os de `SiteNav` e `getCategories` e adicionar:

```tsx
import { HubHeaderSlot } from "../_components/hub/hub-header";
import { cadastroHref } from "../_components/hub/doors";
```

- **Redirecionamento:** em `PedidosContent`, trocar `if (!buyer) redirect("/");` por `if (!buyer) redirect(cadastroHref("/pedidos"));`.
- **Página:** substituir `PedidosPage` por:

```tsx
export default function PedidosPage() {
  return (
    <div className="ba-page">
      <style>{BUYER_STYLES}</style>

      <LeadGateProvider>
        <HubHeaderSlot />
        <Suspense fallback={null}>
          <PedidosContent />
        </Suspense>
      </LeadGateProvider>
    </div>
  );
}
```

- **Teste:** em `pedidos/page.test.tsx`, o `vi.mock("@mypet/core/catalog", …)` deixa de ser necessário. Pode apagar a linha.

- [ ] **Step 6: `proxy.ts`**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { cadastroHref } from "./app/_components/hub/doors";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // /loja e o catálogo digital (/catalogo, HTML estático em public/) mostram
  // preços: só para lojistas com acesso liberado. O visitante do catálogo vai
  // ao cadastro e volta para ele; a /loja segue escondida e manda para a home.
  const isCatalogo = pathname === "/catalogo" || pathname.startsWith("/catalogo/");
  const isProtected = isCatalogo || pathname === "/loja" || pathname.startsWith("/loja/");
  if (isProtected) {
    const deny = () => NextResponse.redirect(new URL(isCatalogo ? cadastroHref("/catalogo") : "/", request.url));
    try {
      const { verifyAccessToken, ACCESS_COOKIE } = await import("@mypet/core/access-session");
      if (!verifyAccessToken(request.cookies.get(ACCESS_COOKIE)?.value)) return deny();
    } catch {
      return deny();
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/loja", "/loja/:path*", "/catalogo", "/catalogo/:path*"],
};
```

A palavra "loja" que aparece no comentário não é copy visível, então está fora da regra.

- [ ] **Step 7: Rodar e ver passar**

Run: `pnpm exec vitest run app/pedido-rapido app/pedidos app/cotacao proxy.test.ts && pnpm exec tsc --noEmit`
Expected: PASS e `tsc` sem erros.

- [ ] **Step 8: Commit**

```bash
git add apps/mypet/app/pedido-rapido apps/mypet/app/cotacao apps/mypet/app/pedidos apps/mypet/proxy.ts apps/mypet/proxy.test.ts
git commit -m "feat(hub): área do cliente com o cabeçalho do hub e cadastro que volta para a página pedida"
```

---

### Task 8: Remover código morto da landing

**Files:**
- Delete: `apps/mypet/app/_components/pre-access/quick-access-steps.tsx`, `quick-access-steps.test.tsx`, `testimonials.tsx`, `testimonials.test.tsx`
- Modify: `apps/mypet/app/pre-access-content.ts` (remove `quickAccessSteps` e `testimonials`, incluindo o comentário `// TODO: substituir por depoimentos reais…`)
- Modify: `apps/mypet/app/pre-access-content.test.ts`
- Modify: `apps/mypet/app/_components/pre-access/styles.ts` (remove o bloco `/* testimonials */`, as 7 regras `.pa-quote*` e a media query `.pa-quote-grid`)

Não remover `AgentEntry`: ele é usado em `commercial-faq.tsx`. Não remover `/api/assistant` nem `AssistantSearch`: a `/loja` escondida depende deles.

- [ ] **Step 1: Confirmar que nada de produção usa os dois componentes**

Run: `grep -rn "QuickAccessSteps\|Testimonials\|quickAccessSteps\|testimonials\|pa-quote\|pa-qa-" app --include=*.ts --include=*.tsx`
Expected: só aparecem os próprios arquivos, `pre-access-content.ts`, `pre-access-content.test.ts` e o CSS em `styles.ts`. Se aparecer outro arquivo, pare e reavalie.

- [ ] **Step 2: Apagar e editar**

```bash
git rm apps/mypet/app/_components/pre-access/quick-access-steps.tsx apps/mypet/app/_components/pre-access/quick-access-steps.test.tsx apps/mypet/app/_components/pre-access/testimonials.tsx apps/mypet/app/_components/pre-access/testimonials.test.tsx
```

Em `pre-access-content.ts`, apagar o `export const quickAccessSteps = [ … ] as const;` e o `export const testimonials = [ … ] as const;`, com o comentário TODO acima dele.

Em `pre-access-content.test.ts`:
- tirar `quickAccessSteps` e `testimonials` do import;
- apagar os testes "tem exatamente 3 passos de consulta rápida" e "tem 3 depoimentos com nome, cidade e loja";
- no teste de em-dash, deixar o objeto como:

```ts
    const blob = JSON.stringify({
      commercialConditions,
      whyBuyPoints,
      steps,
    });
```

Em `styles.ts`, apagar o comentário `/* testimonials */` e as linhas `.pa-quote-grid …` até `@media (max-width: 900px) { .pa-quote-grid { grid-template-columns: 1fr; } }`. Se o passo 1 mostrou classes `pa-qa-` usadas só por `quick-access-steps.tsx`, apague essas também.

- [ ] **Step 3: Rodar a suíte e os tipos**

Run: `pnpm test && pnpm exec tsc --noEmit`
Expected: todos os testes passam e `tsc` sem erros.

- [ ] **Step 4: Commit**

```bash
git add -A apps/mypet/app
git commit -m "chore(landing): remove passos de consulta rápida e depoimentos fictícios sem uso"
```

---

### Task 9: Verificação final no app rodando

- [ ] **Step 1: Suíte completa, tipos, lint e build**

Run (em `apps/mypet`): `pnpm test && pnpm exec tsc --noEmit && pnpm build`
Run (na raiz): `pnpm exec eslint apps/mypet`
Expected:
- tudo passa;
- o build lista `/`, `/cadastro`, `/central-de-ajuda` e `/perguntas-frequentes` como pré-renderizadas (com partes dinâmicas), sem erro de "uncached data accessed outside of Suspense".

- [ ] **Step 2: Conferir no navegador**

Run: `pnpm dev`, depois abrir `http://localhost:4100`.

Como visitante (aba anônima):

1. Em `/`, `/cadastro`, `/central-de-ajuda`, `/perguntas-frequentes` e `/agente`, o cabeçalho é o mesmo. Mostra as 4 portas, com "com cadastro" em Tabela e Catálogo, e o botão "Abrir tabela".
2. Clicar em **Catálogo**: abre `/cadastro?next=%2Fcatalogo` com a lista "O que o cadastro libera". Cadastrar um CNPJ de teste: cai em `/catalogo`.
3. Abrir `/pedidos` direto, sem cookie: vai para `/cadastro?next=%2Fpedidos`.

Como cliente:

4. Em `/agente`, `/pedido-rapido`, `/pedidos` e `/central-de-ajuda`, o cabeçalho mostra "Olá, …", Meus pedidos, Seu pedido (n) e Sair. As portas não têm selo.
5. Em 375 px de largura (DevTools), as 4 portas aparecem numa segunda linha com rolagem lateral. Nada estoura a tela.
6. **Sair** volta para a home, com o cabeçalho de visitante.

- [ ] **Step 3: Relatar e perguntar antes de publicar**

Relatar o resultado dos passos 1 e 2, incluindo o que falhou. Não fazer `git push`: o push para a `main` publica na Vercel, então perguntar ao usuário antes.
