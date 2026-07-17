# Mega Menu de categorias — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar o menu principal (`SiteNav`) num Mega Menu responsivo (hover no desktop, toque no mobile), alimentado dinamicamente pela árvore de categorias do catálogo, com painéis multi-coluna, animação via CSS e navegação por teclado/leitor de tela — incluindo novas páginas de listagem por categoria.

**Architecture:** Reaproveita `getCategories()` (já cacheado em `packages/core/src/catalog.ts`). Extrai lógica de árvore/subárvore que hoje só existe dentro de `assistant-server.ts` para `catalog-utils.ts`, reaproveitada tanto pelo assistente de IA quanto pelos novos componentes de menu e pela nova rota `/categoria/[slug]`. `MegaMenu` (desktop) e `MobileMenu` (mobile) são componentes client novos em `packages/core/src/components`, renderizados dentro de `SiteNav`, que passa a receber a lista de categorias como prop.

**Tech Stack:** Next.js 16 (App Router, Cache Components), React 19, TypeScript, `@radix-ui/react-navigation-menu` + `@radix-ui/react-dialog` + `@radix-ui/react-accordion` (novas dependências), Vitest, pnpm workspaces.

## Global Constraints

- Reaproveitar `getCategories()` já existente — sem mudança de schema no Supabase `hub_catalogo`.
- Sem destaques/banners/produtos em destaque nas colunas do painel (fora de escopo).
- Sem ícones por categoria (fora de escopo, texto puro).
- Painel do Mega Menu mostra só 2 níveis (categoria de nível 1 na barra, subcategorias de nível 2 nas colunas). Nível 3 não aparece no menu.
- Mobile usa drawer full-screen com acordeão (Radix `Dialog` + `Accordion`), não o mesmo painel do desktop.
- Clique numa categoria/subcategoria leva para a nova rota `/categoria/[slug]`, implementada em `apps/mypet` e `apps/distribuidora`.
- Nenhuma lib de animação (framer-motion) é instalada — animação via CSS puro sobre os atributos `data-state` do Radix.
- Todo componente novo em `packages/core` deve funcionar nos dois apps (`mypet` e `distribuidora`) sem lógica condicional por cliente.
- Segue os padrões já estabelecidos no repositório: inline styles lendo a `Palette` do tema (`useClientConfig()`), `<style>{...}</style>` embutido nos componentes/páginas, testes unitários com Vitest só para lógica pura (não há testes de componente React no repo).

---

## Task 1: Mover `CategoryNode` e criar `buildCategoryTree` em `catalog-utils.ts`

**Files:**
- Modify: `packages/core/src/catalog-utils.ts`
- Modify: `packages/core/src/catalog.ts:142-148` (remove a definição local do tipo)
- Test: `packages/core/src/catalog-utils.test.ts`

**Interfaces:**
- Consumes: nada de tarefas anteriores.
- Produces: `CategoryNode` (tipo movido, mesma forma de antes: `{ id: string; parentId: string | null; slug: string; name: string; level: number | null }`), `CategoryTreeNode = CategoryNode & { children: CategoryTreeNode[] }`, `buildCategoryTree(categories: CategoryNode[]): CategoryTreeNode[]` — usados pelas Tasks 4, 5, 6, 9.

- [ ] **Step 1: Escrever o teste falho para `buildCategoryTree`**

Adicione ao final de `packages/core/src/catalog-utils.test.ts` (mantendo os `describe` existentes intactos):

```ts
import { buildCategoryTree, type CategoryNode } from "./catalog-utils";

const SAMPLE_CATEGORIES: CategoryNode[] = [
  { id: "c1", parentId: null, slug: "caes", name: "Cães", level: 1 },
  { id: "c2", parentId: "c1", slug: "caes-racao", name: "Ração", level: 2 },
  { id: "c3", parentId: "c2", slug: "caes-racao-seca", name: "Ração Seca", level: 3 },
  { id: "c4", parentId: null, slug: "gatos", name: "Gatos", level: 1 },
];

describe("buildCategoryTree", () => {
  it("agrupa categorias planas em árvore por parentId, preservando a ordem de entrada", () => {
    const tree = buildCategoryTree(SAMPLE_CATEGORIES);
    expect(tree).toEqual([
      {
        id: "c1", parentId: null, slug: "caes", name: "Cães", level: 1,
        children: [
          {
            id: "c2", parentId: "c1", slug: "caes-racao", name: "Ração", level: 2,
            children: [
              { id: "c3", parentId: "c2", slug: "caes-racao-seca", name: "Ração Seca", level: 3, children: [] },
            ],
          },
        ],
      },
      { id: "c4", parentId: null, slug: "gatos", name: "Gatos", level: 1, children: [] },
    ]);
  });

  it("retorna lista vazia para entrada vazia", () => {
    expect(buildCategoryTree([])).toEqual([]);
  });
});
```

Adicione `buildCategoryTree` e `type CategoryNode` ao bloco de import já existente no topo do arquivo (`import { parsePage, pageRange, ... } from "./catalog-utils";`) — mantenha os demais imports como estão, só acrescente esses dois nomes.

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `pnpm --filter @mypet/core exec vitest run src/catalog-utils.test.ts`
Expected: FAIL — `buildCategoryTree` não está exportado por `./catalog-utils` (erro de import/undefined).

- [ ] **Step 3: Implementar `CategoryNode`, `CategoryTreeNode` e `buildCategoryTree` em `catalog-utils.ts`**

Adicione logo abaixo da definição de `export type RawCategory = { id: string; name: string; slug: string };` (linha 15 hoje) em `packages/core/src/catalog-utils.ts`:

```ts
export type CategoryNode = {
  id: string;
  parentId: string | null;
  slug: string;
  name: string;
  level: number | null;
};

export type CategoryTreeNode = CategoryNode & { children: CategoryTreeNode[] };
```

E adicione ao final do arquivo (depois de `mapProduct`):

```ts
export function buildCategoryTree(categories: CategoryNode[]): CategoryTreeNode[] {
  const nodesById = new Map<string, CategoryTreeNode>();
  for (const c of categories) {
    nodesById.set(c.id, { ...c, children: [] });
  }
  const roots: CategoryTreeNode[] = [];
  for (const c of categories) {
    const node = nodesById.get(c.id)!;
    if (c.parentId && nodesById.has(c.parentId)) {
      nodesById.get(c.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `pnpm --filter @mypet/core exec vitest run src/catalog-utils.test.ts`
Expected: PASS (todos os `describe`, incluindo os dois novos de `buildCategoryTree`).

- [ ] **Step 5: Remover a definição duplicada de `CategoryNode` em `catalog.ts` e importar de `catalog-utils.ts`**

Em `packages/core/src/catalog.ts`, no topo do arquivo, troque:

```ts
import {
  mapProduct,
  pageRange,
  totalPages,
  mainImage,
  pickActiveBadge,
  type CatalogResult,
  type RawProductRow,
} from "./catalog-utils";
```

por:

```ts
import {
  mapProduct,
  pageRange,
  totalPages,
  mainImage,
  pickActiveBadge,
  type CatalogResult,
  type RawProductRow,
  type CategoryNode,
} from "./catalog-utils";
```

E remova o bloco (linhas 142-148 hoje, logo antes de `export async function getCategories()`):

```ts
export type CategoryNode = {
  id: string;
  parentId: string | null;
  slug: string;
  name: string;
  level: number | null;
};

```

deixando só a função `getCategories` (que continua usando `CategoryNode` normalmente, agora vindo do import).

- [ ] **Step 6: Rodar toda a suíte de `packages/core` e confirmar que nada quebrou**

Run: `pnpm --filter @mypet/core test`
Expected: PASS em todos os arquivos, incluindo `catalog.test.ts` (que importa `getCategories` de `./catalog` sem mudança de comportamento).

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/catalog-utils.ts packages/core/src/catalog-utils.test.ts packages/core/src/catalog.ts
git commit -m "refactor: move CategoryNode e adiciona buildCategoryTree em catalog-utils"
```

---

## Task 2: Extrair `collectCategorySubtreeIds` e `getCategoryPath` para `catalog-utils.ts`

**Files:**
- Modify: `packages/core/src/catalog-utils.ts`
- Modify: `packages/core/src/assistant-server.ts:1-123`
- Test: `packages/core/src/catalog-utils.test.ts`

**Interfaces:**
- Consumes: `CategoryNode` (Task 1).
- Produces: `collectCategorySubtreeIds(categories: CategoryNode[], rootId: string): string[]`, `getCategoryPath(categories: CategoryNode[], nodeId: string): CategoryNode[]` (raiz → nó, em ordem) — usados pela Task 9 (`category-listing.tsx`) e por `assistant-server.ts`.

- [ ] **Step 1: Escrever os testes falhos**

Adicione ao final de `packages/core/src/catalog-utils.test.ts`:

```ts
import { collectCategorySubtreeIds, getCategoryPath } from "./catalog-utils";

describe("collectCategorySubtreeIds", () => {
  it("devolve o próprio id e todos os descendentes, em profundidade", () => {
    expect(collectCategorySubtreeIds(SAMPLE_CATEGORIES, "c1")).toEqual(["c1", "c2", "c3"]);
  });

  it("devolve só o próprio id quando não há filhos", () => {
    expect(collectCategorySubtreeIds(SAMPLE_CATEGORIES, "c4")).toEqual(["c4"]);
  });
});

describe("getCategoryPath", () => {
  it("devolve o caminho da raiz até o nó, em ordem", () => {
    expect(getCategoryPath(SAMPLE_CATEGORIES, "c3")).toEqual([
      SAMPLE_CATEGORIES[0],
      SAMPLE_CATEGORIES[1],
      SAMPLE_CATEGORIES[2],
    ]);
  });

  it("devolve array de 1 item para uma categoria de nível 1", () => {
    expect(getCategoryPath(SAMPLE_CATEGORIES, "c1")).toEqual([SAMPLE_CATEGORIES[0]]);
  });
});
```

(`SAMPLE_CATEGORIES` já foi declarado na Task 1, no mesmo arquivo — reaproveite, não redeclare.)

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `pnpm --filter @mypet/core exec vitest run src/catalog-utils.test.ts`
Expected: FAIL — `collectCategorySubtreeIds`/`getCategoryPath` não exportados.

- [ ] **Step 3: Implementar as duas funções em `catalog-utils.ts`**

Adicione ao final do arquivo (depois de `buildCategoryTree`):

```ts
export function collectCategorySubtreeIds(categories: CategoryNode[], rootId: string): string[] {
  const childrenByParent = new Map<string, string[]>();
  for (const c of categories) {
    if (!c.parentId) continue;
    const siblings = childrenByParent.get(c.parentId) ?? [];
    siblings.push(c.id);
    childrenByParent.set(c.parentId, siblings);
  }
  const ids: string[] = [];
  const visit = (id: string) => {
    ids.push(id);
    for (const childId of childrenByParent.get(id) ?? []) visit(childId);
  };
  visit(rootId);
  return ids;
}

export function getCategoryPath(categories: CategoryNode[], nodeId: string): CategoryNode[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const path: CategoryNode[] = [];
  let current = byId.get(nodeId);
  while (current) {
    path.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return path;
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `pnpm --filter @mypet/core exec vitest run src/catalog-utils.test.ts`
Expected: PASS.

- [ ] **Step 5: Atualizar `assistant-server.ts` para reaproveitar as funções extraídas**

Em `packages/core/src/assistant-server.ts`, troque a linha de import (linha 4 hoje):

```ts
import { getCatalog, getCategories, type CategoryNode } from "./catalog";
```

por:

```ts
import { getCatalog, getCategories } from "./catalog";
import { collectCategorySubtreeIds, getCategoryPath, type CategoryNode } from "./catalog-utils";
```

Remova a função local `collectCategorySubtreeIds` inteira (linhas 84-99 hoje):

```ts
function collectCategorySubtreeIds(categories: CategoryNode[], rootId: string): string[] {
  const childrenByParent = new Map<string, string[]>();
  for (const c of categories) {
    if (!c.parentId) continue;
    const siblings = childrenByParent.get(c.parentId) ?? [];
    siblings.push(c.id);
    childrenByParent.set(c.parentId, siblings);
  }
  const ids: string[] = [];
  const visit = (id: string) => {
    ids.push(id);
    for (const childId of childrenByParent.get(id) ?? []) visit(childId);
  };
  visit(rootId);
  return ids;
}

```

E troque a função local `formatCategories` (linhas 101-108 hoje) para usar `getCategoryPath` em vez do `pathFor` recursivo próprio:

```ts
function formatCategories(categories: CategoryNode[]): string {
  return categories
    .map((c) => `${c.slug}: ${getCategoryPath(categories, c.id).map((n) => n.name).join(" > ")}`)
    .join("\n");
}
```

Nada mais no arquivo muda — o restante do código (`buildSystemPrompt`, `buildAssistantTools`, `createAssistantHandler`) já chama `collectCategorySubtreeIds` e `formatCategories` pelo nome, e continua funcionando porque `collectCategorySubtreeIds` agora vem do import.

- [ ] **Step 6: Rodar a suíte completa de `packages/core` e confirmar que nada quebrou**

Run: `pnpm --filter @mypet/core test`
Expected: PASS em todos os arquivos, incluindo `assistant-server.test.ts` (os testes de `buildAssistantTools` em torno das linhas 137-225 continuam passando, já que o comportamento de `collectCategorySubtreeIds` não mudou).

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/catalog-utils.ts packages/core/src/catalog-utils.test.ts packages/core/src/assistant-server.ts
git commit -m "refactor: extrai collectCategorySubtreeIds e getCategoryPath pra catalog-utils"
```

---

## Task 3: Instalar dependências Radix UI em `packages/core`

**Files:**
- Modify: `packages/core/package.json`

**Interfaces:**
- Consumes: nada.
- Produces: `@radix-ui/react-navigation-menu`, `@radix-ui/react-dialog`, `@radix-ui/react-accordion` disponíveis para import em `packages/core/src/components/*` (Tasks 4 e 5). Os arquivos `.tsx` novos em `src/components/` já são expostos automaticamente pelo mapa de `exports` existente (`"./components/*": "./src/components/*.tsx"`), sem precisar editar essa seção.

- [ ] **Step 1: Instalar os pacotes**

Run: `pnpm --filter @mypet/core add @radix-ui/react-navigation-menu@^1.2.18 @radix-ui/react-dialog@^1.1.19 @radix-ui/react-accordion@^1.2.16`
Expected: comando termina sem erro; `packages/core/package.json` ganha as três entradas em `dependencies`; `pnpm-lock.yaml` na raiz é atualizado.

- [ ] **Step 2: Confirmar que a instalação não quebrou o build/testes existentes**

Run: `pnpm --filter @mypet/core test`
Expected: PASS (mesmo resultado da Task 2, Step 6 — a instalação de dependência não deve alterar nenhum teste).

- [ ] **Step 3: Commit**

```bash
git add packages/core/package.json pnpm-lock.yaml
git commit -m "chore: adiciona radix-ui (navigation-menu, dialog, accordion) ao core"
```

---

## Task 4: Criar `MegaMenu` (painel desktop)

**Files:**
- Create: `packages/core/src/components/mega-menu.tsx`

**Interfaces:**
- Consumes: `CategoryTreeNode` (Task 1), `useClientConfig()` de `../theme` (já existente), pacote `@radix-ui/react-navigation-menu` (Task 3).
- Produces: `MegaMenu({ tree: CategoryTreeNode[] })` (client component) — consumido pela Task 6 (`SiteNav`).

- [ ] **Step 1: Criar o componente**

Crie `packages/core/src/components/mega-menu.tsx`:

```tsx
"use client";

import Link from "next/link";
import * as NavigationMenu from "@radix-ui/react-navigation-menu";
import { useClientConfig } from "../theme";
import type { CategoryTreeNode } from "../catalog-utils";

export function MegaMenu({ tree }: { tree: CategoryTreeNode[] }) {
  const { palette } = useClientConfig();

  if (tree.length === 0) return null;

  return (
    <NavigationMenu.Root style={{ position: "relative" }}>
      <NavigationMenu.List
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          listStyle: "none",
          margin: 0,
          padding: 0,
          flexWrap: "wrap",
        }}
      >
        {tree.map((category) => (
          <NavigationMenu.Item key={category.id}>
            {category.children.length > 0 ? (
              <>
                <NavigationMenu.Trigger className="mega-menu-trigger">
                  {category.name}
                </NavigationMenu.Trigger>
                <NavigationMenu.Content className="mega-menu-content">
                  <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 24px" }}>
                    <Link
                      href={`/categoria/${category.slug}`}
                      className="mega-menu-see-all"
                      style={{ color: palette.pink }}
                    >
                      Ver todos os produtos de {category.name} →
                    </Link>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                        gap: 24,
                        marginTop: 20,
                      }}
                    >
                      {category.children.map((sub) => (
                        <Link
                          key={sub.id}
                          href={`/categoria/${sub.slug}`}
                          style={{
                            display: "block",
                            fontSize: 14,
                            fontWeight: 700,
                            color: palette.navy,
                            textDecoration: "none",
                          }}
                        >
                          {sub.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                </NavigationMenu.Content>
              </>
            ) : (
              <NavigationMenu.Link asChild>
                <Link href={`/categoria/${category.slug}`} className="mega-menu-trigger">
                  {category.name}
                </Link>
              </NavigationMenu.Link>
            )}
          </NavigationMenu.Item>
        ))}
      </NavigationMenu.List>

      <div className="mega-menu-viewport-wrapper">
        <NavigationMenu.Viewport className="mega-menu-viewport" />
      </div>

      <style>{`
        .mega-menu-trigger {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 12px 14px;
          background: transparent;
          border: none;
          font-family: 'Nunito', sans-serif;
          font-size: 14px;
          font-weight: 700;
          color: ${palette.navy};
          text-decoration: none;
          cursor: pointer;
          border-radius: 8px;
        }
        .mega-menu-trigger:hover,
        .mega-menu-trigger:focus-visible {
          color: ${palette.pink};
          background: ${palette.gray50};
          outline: none;
        }
        .mega-menu-viewport-wrapper {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          display: flex;
          justify-content: center;
          z-index: 90;
        }
        .mega-menu-viewport {
          width: 100%;
          background: ${palette.white};
          border: 1px solid ${palette.gray200};
          border-top: none;
          border-radius: 0 0 16px 16px;
          box-shadow: 0 20px 40px rgba(26,52,114,0.12);
          overflow: hidden;
        }
        .mega-menu-content {
          animation: megaMenuFadeOut 0.15s ease forwards;
        }
        .mega-menu-content[data-state="open"] {
          animation: megaMenuFadeIn 0.2s ease forwards;
        }
        @keyframes megaMenuFadeIn {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes megaMenuFadeOut {
          from { opacity: 1; transform: translateY(0); }
          to { opacity: 0; transform: translateY(-6px); }
        }
        .mega-menu-see-all {
          display: inline-block;
          font-size: 13px;
          font-weight: 800;
          text-decoration: none;
        }
      `}</style>
    </NavigationMenu.Root>
  );
}
```

- [ ] **Step 2: Verificar que o pacote compila via typecheck do Next**

Run: `pnpm --filter mypet exec tsc --noEmit`
Expected: sem erros de tipo relacionados a `mega-menu.tsx` (o comando pode reportar avisos preexistentes de outros arquivos não relacionados — só precisa não introduzir erro novo neste arquivo).

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/components/mega-menu.tsx
git commit -m "feat: adiciona componente MegaMenu (painel desktop com Radix NavigationMenu)"
```

---

## Task 5: Criar `MobileMenu` (drawer + acordeão)

**Files:**
- Create: `packages/core/src/components/mobile-menu.tsx`

**Interfaces:**
- Consumes: `CategoryTreeNode` (Task 1), `useClientConfig()`, pacotes `@radix-ui/react-dialog` e `@radix-ui/react-accordion` (Task 3).
- Produces: `MobileMenu({ tree: CategoryTreeNode[] })` (client component, inclui seu próprio botão de abertura ☰) — consumido pela Task 6 (`SiteNav`).

- [ ] **Step 1: Criar o componente**

Crie `packages/core/src/components/mobile-menu.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import * as Accordion from "@radix-ui/react-accordion";
import { useClientConfig } from "../theme";
import type { CategoryTreeNode } from "../catalog-utils";

export function MobileMenu({ tree }: { tree: CategoryTreeNode[] }) {
  const { palette } = useClientConfig();
  const [open, setOpen] = useState(false);

  if (tree.length === 0) return null;

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label="Abrir menu de categorias"
          style={{ background: "transparent", border: "none", fontSize: 22, cursor: "pointer", color: palette.navy, padding: 6 }}
        >
          ☰
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="mobile-menu-overlay" />
        <Dialog.Content className="mobile-menu-content" aria-describedby={undefined}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${palette.gray200}` }}>
            <Dialog.Title style={{ fontSize: 16, fontWeight: 800, color: palette.navy, margin: 0 }}>
              Categorias
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Fechar menu"
                style={{ background: "transparent", border: "none", fontSize: 22, cursor: "pointer", color: palette.gray600 }}
              >
                ×
              </button>
            </Dialog.Close>
          </div>

          <Accordion.Root type="multiple" style={{ padding: "8px 0" }}>
            {tree.map((category) =>
              category.children.length > 0 ? (
                <Accordion.Item key={category.id} value={category.id} style={{ borderBottom: `1px solid ${palette.gray100}` }}>
                  <Accordion.Header>
                    <Accordion.Trigger className="mobile-menu-accordion-trigger" style={{ color: palette.navy }}>
                      {category.name}
                      <span aria-hidden="true" className="mobile-menu-chevron">⌄</span>
                    </Accordion.Trigger>
                  </Accordion.Header>
                  <Accordion.Content className="mobile-menu-accordion-content">
                    <div style={{ padding: "4px 20px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                      <Link
                        href={`/categoria/${category.slug}`}
                        onClick={() => setOpen(false)}
                        style={{ fontSize: 13, fontWeight: 800, color: palette.pink, textDecoration: "none" }}
                      >
                        Ver todos de {category.name}
                      </Link>
                      {category.children.map((sub) => (
                        <Link
                          key={sub.id}
                          href={`/categoria/${sub.slug}`}
                          onClick={() => setOpen(false)}
                          style={{ fontSize: 14, color: palette.gray600, textDecoration: "none" }}
                        >
                          {sub.name}
                        </Link>
                      ))}
                    </div>
                  </Accordion.Content>
                </Accordion.Item>
              ) : (
                <div key={category.id} style={{ borderBottom: `1px solid ${palette.gray100}` }}>
                  <Link
                    href={`/categoria/${category.slug}`}
                    onClick={() => setOpen(false)}
                    style={{ display: "block", padding: "14px 20px", fontSize: 15, fontWeight: 700, color: palette.navy, textDecoration: "none" }}
                  >
                    {category.name}
                  </Link>
                </div>
              ),
            )}
          </Accordion.Root>

          <style>{`
            .mobile-menu-overlay {
              position: fixed;
              inset: 0;
              background: rgba(15,31,69,0.5);
              z-index: 998;
            }
            .mobile-menu-overlay[data-state="open"] { animation: mobileMenuOverlayShow 0.15s ease; }
            .mobile-menu-content {
              position: fixed;
              inset: 0;
              background: ${palette.white};
              z-index: 999;
              overflow-y: auto;
            }
            .mobile-menu-content[data-state="open"] { animation: mobileMenuSlideIn 0.2s ease; }
            .mobile-menu-content[data-state="closed"] { animation: mobileMenuSlideOut 0.15s ease; }
            .mobile-menu-accordion-trigger {
              width: 100%;
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding: 14px 20px;
              background: transparent;
              border: none;
              font-family: 'Nunito', sans-serif;
              font-size: 15px;
              font-weight: 700;
              cursor: pointer;
              text-align: left;
            }
            .mobile-menu-chevron { transition: transform 0.2s; font-size: 16px; }
            .mobile-menu-accordion-trigger[data-state="open"] .mobile-menu-chevron { transform: rotate(180deg); }
            .mobile-menu-accordion-content { overflow: hidden; }
            .mobile-menu-accordion-content[data-state="open"] { animation: mobileAccordionOpen 0.2s ease; }
            .mobile-menu-accordion-content[data-state="closed"] { animation: mobileAccordionClose 0.2s ease; }
            @keyframes mobileMenuOverlayShow { from { opacity: 0; } to { opacity: 1; } }
            @keyframes mobileMenuSlideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
            @keyframes mobileMenuSlideOut { from { transform: translateX(0); } to { transform: translateX(100%); } }
            @keyframes mobileAccordionOpen { from { height: 0; opacity: 0; } to { height: var(--radix-accordion-content-height); opacity: 1; } }
            @keyframes mobileAccordionClose { from { height: var(--radix-accordion-content-height); opacity: 1; } to { height: 0; opacity: 0; } }
          `}</style>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `pnpm --filter mypet exec tsc --noEmit`
Expected: sem erro novo relacionado a `mobile-menu.tsx`.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/components/mobile-menu.tsx
git commit -m "feat: adiciona componente MobileMenu (drawer + acordeao com Radix Dialog/Accordion)"
```

---

## Task 6: Atualizar `SiteNav` para montar a árvore e renderizar os dois menus

**Files:**
- Modify: `packages/core/src/components/site-nav.tsx`

**Interfaces:**
- Consumes: `MegaMenu` (Task 4), `MobileMenu` (Task 5), `buildCategoryTree`/`CategoryNode` (Task 1).
- Produces: `SiteNav({ categories: CategoryNode[] })` (assinatura muda — antes não recebia props) — consumido pelas Tasks 7 e 8.

- [ ] **Step 1: Reescrever `site-nav.tsx`**

Substitua todo o conteúdo de `packages/core/src/components/site-nav.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useClientConfig } from "../theme";
import { UnlockButton } from "./lead-gate";
import { CartBadge } from "./cart-badge";
import { MegaMenu } from "./mega-menu";
import { MobileMenu } from "./mobile-menu";
import { buildCategoryTree, type CategoryNode } from "../catalog-utils";

export function SiteNav({ categories }: { categories: CategoryNode[] }) {
  const { name, tagline, palette, logo } = useClientConfig();
  const tree = buildCategoryTree(categories);

  return (
    <nav style={{ background: palette.white, borderBottom: `1px solid ${palette.gray200}`, position: "sticky", top: 0, zIndex: 100 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className="site-nav-mobile-trigger">
            <MobileMenu tree={tree} />
          </div>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <div style={{ width: 34, height: 34, background: palette.pink, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 18 }}>{logo.emoji}</span>
            </div>
            <div>
              <div style={{ fontWeight: 900, fontSize: 15, color: palette.navy, lineHeight: 1 }}>{name}</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: palette.pink, letterSpacing: "0.12em", textTransform: "uppercase" }}>{tagline}</div>
            </div>
          </Link>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, color: palette.gray600, fontWeight: 600 }}>Exclusivo para lojistas</span>
          <CartBadge />
          <UnlockButton className="cta-primary" style={{ padding: "10px 22px", fontSize: 14 }}>
            Solicitar cotação
          </UnlockButton>
        </div>
      </div>

      <div className="site-nav-mega-menu-row" style={{ borderTop: `1px solid ${palette.gray100}` }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 12px" }}>
          <MegaMenu tree={tree} />
        </div>
      </div>

      <style>{`
        .site-nav-mobile-trigger { display: none; }
        @media (max-width: 768px) {
          .site-nav-mega-menu-row { display: none; }
          .site-nav-mobile-trigger { display: flex; }
        }
      `}</style>
    </nav>
  );
}
```

- [ ] **Step 2: Verificar typecheck (vai apontar os call-sites desatualizados, esperado nesta etapa)**

Run: `pnpm --filter mypet exec tsc --noEmit`
Expected: erros do tipo `Property 'categories' is missing` nos arquivos que ainda chamam `<SiteNav />` sem props — são exatamente os 6 `page.tsx` que as Tasks 7 e 8 corrigem a seguir. Confirme que o erro aponta pra esses arquivos e não pra `site-nav.tsx` em si.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/components/site-nav.tsx
git commit -m "feat: SiteNav recebe categories e renderiza MegaMenu/MobileMenu"
```

---

## Task 7: Dividir `cotacao/page.tsx` em shell server-side + `cotacao-content.tsx` client (× 2 apps)

**Contexto:** `cotacao/page.tsx` hoje é inteiramente `"use client"` (usa `useState`/`useCart` no próprio componente de página), o que impede chamar `getCategories()` — uma função server-only cacheada com `next/cache` — diretamente nele. É preciso separar a busca de categorias (server) da interatividade do carrinho/formulário (client), no mesmo padrão que `produtos/[id]/page.tsx` já usa (página server, partes interativas em componentes client à parte).

**Files:**
- Create: `apps/mypet/app/cotacao/cotacao-content.tsx`
- Create: `apps/distribuidora/app/cotacao/cotacao-content.tsx`
- Modify: `apps/mypet/app/cotacao/page.tsx`
- Modify: `apps/distribuidora/app/cotacao/page.tsx`

**Interfaces:**
- Consumes: `SiteNav({ categories })` (Task 6), `getCategories()` (já existente em `@mypet/core/catalog`).
- Produces: nada consumido por tarefas futuras.

- [ ] **Step 1: Criar `apps/mypet/app/cotacao/cotacao-content.tsx`**

Conteúdo idêntico à função `CotacaoContent` que hoje vive dentro de `apps/mypet/app/cotacao/page.tsx` (linhas 116-254), extraída pra um arquivo próprio e recebendo `palette` como prop em vez de ler a constante de módulo `PALETTE`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@mypet/core/components/cart-provider";
import { submitLead } from "@mypet/core/leads";
import { buildQuoteMessage, buildWhatsAppLink } from "@mypet/core/whatsapp";
import type { Palette } from "@mypet/core/theme";

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "";

export function CotacaoContent({ palette: PALETTE }: { palette: Palette }) {
  const { cart, removeItem, updateQty, clear } = useCart();
  const [form, setForm] = useState({ nome: "", empresa: "", whatsapp: "", cnpj: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <div style={{ background: PALETTE.white, border: `1px solid ${PALETTE.gray200}`, borderRadius: 16, padding: 32, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
        <h2 style={{ fontSize: 20, fontWeight: 900, color: PALETTE.navy, marginBottom: 8 }}>
          Cotação enviada!
        </h2>
        <p style={{ fontSize: 14, color: PALETTE.gray600, marginBottom: 20 }}>
          Abrimos o WhatsApp com os itens da sua cotação. Nossa equipe vai te responder por lá.
        </p>
        <Link href="/" className="cta-primary" style={{ textDecoration: "none", display: "inline-block" }}>
          Voltar ao catálogo
        </Link>
      </div>
    );
  }

  if (cart.items.length === 0) {
    return (
      <div style={{ background: PALETTE.white, border: `1px solid ${PALETTE.gray200}`, borderRadius: 16, padding: 32, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🛒</div>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: PALETTE.navy, marginBottom: 8 }}>
          Sua cotação está vazia
        </h2>
        <p style={{ fontSize: 14, color: PALETTE.gray600, marginBottom: 20 }}>
          Adicione produtos do catálogo para montar sua cotação.
        </p>
        <Link href="/" className="cta-primary" style={{ textDecoration: "none", display: "inline-block" }}>
          Ver catálogo
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!WHATSAPP_NUMBER) {
      setSubmitError("Não foi possível abrir o WhatsApp agora. Tente novamente mais tarde.");
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    const error = await submitLead(form);
    if (error) {
      setSubmitError(error);
      setSubmitting(false);
      return;
    }

    const message = buildQuoteMessage(cart.items, form);
    window.open(buildWhatsAppLink(WHATSAPP_NUMBER, message), "_blank");

    clear();
    setSubmitted(true);
    setSubmitting(false);
  };

  return (
    <>
      <div style={{ background: PALETTE.white, border: `1px solid ${PALETTE.gray200}`, borderRadius: 16, marginBottom: 24, overflow: "hidden" }}>
        {cart.items.map((item, index) => (
          <div
            key={item.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: 16,
              borderBottom: index < cart.items.length - 1 ? `1px solid ${PALETTE.gray100}` : "none",
            }}
          >
            <img src={item.img} alt={item.name} style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              {item.brand && (
                <p style={{ fontSize: 10, color: PALETTE.pink, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>
                  {item.brand}
                </p>
              )}
              <p style={{ fontSize: 14, fontWeight: 700, color: PALETTE.navy, lineHeight: 1.3 }}>{item.name}</p>
              {item.sku && <p style={{ fontSize: 11, color: PALETTE.gray400 }}>SKU: {item.sku}</p>}
            </div>
            <div style={{ display: "flex", alignItems: "center", border: `1.5px solid ${PALETTE.gray200}`, borderRadius: 8 }}>
              <button
                type="button"
                onClick={() => updateQty(item.id, item.qty - 1)}
                aria-label="Diminuir quantidade"
                style={{ width: 28, height: 28, border: "none", background: "transparent", cursor: "pointer", fontSize: 16, color: PALETTE.gray600 }}
              >
                −
              </button>
              <span style={{ minWidth: 24, textAlign: "center", fontSize: 13, fontWeight: 700, color: PALETTE.navy }}>{item.qty}</span>
              <button
                type="button"
                onClick={() => updateQty(item.id, item.qty + 1)}
                aria-label="Aumentar quantidade"
                style={{ width: 28, height: 28, border: "none", background: "transparent", cursor: "pointer", fontSize: 16, color: PALETTE.gray600 }}
              >
                +
              </button>
            </div>
            <button
              type="button"
              onClick={() => removeItem(item.id)}
              aria-label={`Remover ${item.name} da cotação`}
              style={{ border: "none", background: "transparent", color: PALETTE.gray400, cursor: "pointer", fontSize: 13, fontWeight: 700 }}
            >
              Remover
            </button>
          </div>
        ))}
      </div>

      <div style={{ background: PALETTE.white, border: `1px solid ${PALETTE.gray200}`, borderRadius: 16, padding: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: PALETTE.navy, marginBottom: 16 }}>
          Seus dados para a cotação
        </h2>
        <form onSubmit={handleSubmit}>
          <input className="form-input" placeholder="Seu nome" required value={form.nome} onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))} />
          <input className="form-input" placeholder="Nome do pet shop / empresa" required value={form.empresa} onChange={(e) => setForm((prev) => ({ ...prev, empresa: e.target.value }))} />
          <input className="form-input" placeholder="WhatsApp com DDD" required value={form.whatsapp} onChange={(e) => setForm((prev) => ({ ...prev, whatsapp: e.target.value }))} />
          <input className="form-input" placeholder="CNPJ (opcional)" value={form.cnpj} onChange={(e) => setForm((prev) => ({ ...prev, cnpj: e.target.value }))} />
          {submitError && (
            <p style={{ color: PALETTE.orange, fontSize: 13, marginBottom: 8, textAlign: "center" }}>{submitError}</p>
          )}
          <button type="submit" className="form-submit" disabled={submitting}>
            {submitting ? "Enviando..." : "Finalizar cotação →"}
          </button>
        </form>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Criar `apps/distribuidora/app/cotacao/cotacao-content.tsx` com o mesmo conteúdo do Step 1**, trocando só os imports de `@mypet/core/*` (que continuam iguais — `@mypet/core` é o nome do pacote compartilhado usado pelos dois apps, não muda por app).

- [ ] **Step 3: Reescrever `apps/mypet/app/cotacao/page.tsx`**

```tsx
import Link from "next/link";
import { getCategories } from "@mypet/core/catalog";
import { LeadGateProvider } from "@mypet/core/components/lead-gate";
import { SiteNav } from "@mypet/core/components/site-nav";
import { clientConfig } from "@/client.config";
import { CotacaoContent } from "./cotacao-content";

const { palette: PALETTE } = clientConfig;

export default async function CotacaoPage() {
  const categories = await getCategories();

  return (
    <div style={{ fontFamily: "'Nunito', 'Nunito Sans', sans-serif", background: PALETTE.gray50, minHeight: "100vh", color: PALETTE.gray800 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Nunito+Sans:wght@400;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { margin: 0; }

        .cta-primary {
          background: ${PALETTE.pink};
          color: ${PALETTE.white};
          border: none;
          border-radius: 100px;
          padding: 10px 22px;
          font-family: 'Nunito', sans-serif;
          font-size: 14px;
          font-weight: 800;
          cursor: pointer;
          transition: background 0.2s;
        }
        .cta-primary:hover { background: ${PALETTE.pinkDark}; }

        .back-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: ${PALETTE.gray600};
          font-size: 14px;
          font-weight: 700;
          text-decoration: none;
          margin-bottom: 24px;
          transition: color 0.2s;
        }
        .back-link:hover { color: ${PALETTE.pink}; }

        .modal-overlay {
          position: fixed; inset: 0;
          background: rgba(15,31,69,0.6);
          display: flex; align-items: center; justify-content: center;
          z-index: 999;
          padding: 16px;
        }
        .modal {
          background: ${PALETTE.white};
          border-radius: 20px;
          padding: 40px 36px;
          width: 100%;
          max-width: 440px;
        }
        .form-input {
          width: 100%;
          padding: 12px 16px;
          border: 1.5px solid ${PALETTE.gray200};
          border-radius: 10px;
          font-family: 'Nunito Sans', sans-serif;
          font-size: 15px;
          color: ${PALETTE.gray800};
          outline: none;
          transition: border-color 0.2s;
          margin-bottom: 12px;
        }
        .form-input:focus { border-color: ${PALETTE.pink}; }
        .form-submit {
          width: 100%;
          padding: 14px;
          background: ${PALETTE.pink};
          color: white;
          border: none;
          border-radius: 10px;
          font-family: 'Nunito', sans-serif;
          font-size: 16px;
          font-weight: 800;
          cursor: pointer;
          margin-top: 4px;
          transition: background 0.2s;
        }
        .form-submit:hover { background: ${PALETTE.pinkDark}; }
        .form-submit:disabled { opacity: 0.6; cursor: default; }
      `}</style>

      <LeadGateProvider>
        <SiteNav categories={categories} />

        <main style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px 80px" }}>
          <Link href="/" className="back-link">
            ← Voltar ao catálogo
          </Link>

          <h1 style={{ fontSize: 28, fontWeight: 900, color: PALETTE.navy, marginBottom: 24 }}>
            Sua cotação
          </h1>

          <CotacaoContent palette={PALETTE} />
        </main>
      </LeadGateProvider>
    </div>
  );
}
```

- [ ] **Step 4: Reescrever `apps/distribuidora/app/cotacao/page.tsx` com o mesmo conteúdo do Step 3** (o repositório já duplica `page.tsx` sem alterações entre os dois apps — confirme com `diff apps/mypet/app/cotacao/page.tsx apps/distribuidora/app/cotacao/page.tsx` que os arquivos ficam idênticos depois da edição, mesmo padrão que `produtos/[id]/page.tsx` já segue hoje).

- [ ] **Step 5: Rodar typecheck**

Run: `pnpm --filter mypet exec tsc --noEmit && pnpm --filter distribuidora exec tsc --noEmit`
Expected: sem erro relacionado a `cotacao/page.tsx` ou `cotacao-content.tsx` em nenhum dos dois apps.

- [ ] **Step 6: Commit**

```bash
git add apps/mypet/app/cotacao apps/distribuidora/app/cotacao
git commit -m "refactor: separa cotacao/page.tsx em shell server-side e cotacao-content client"
```

---

## Task 8: Buscar `getCategories()` e passar pro `SiteNav` nas 4 páginas restantes

**Files:**
- Modify: `apps/mypet/app/page.tsx`
- Modify: `apps/distribuidora/app/page.tsx`
- Modify: `apps/mypet/app/produtos/[id]/page.tsx`
- Modify: `apps/distribuidora/app/produtos/[id]/page.tsx`

**Interfaces:**
- Consumes: `SiteNav({ categories })` (Task 6), `getCategories()` (já existente em `@mypet/core/catalog`).
- Produces: nada consumido por tarefas futuras.

- [ ] **Step 1: Atualizar `apps/mypet/app/page.tsx`**

No topo do arquivo, adicione `getCategories` ao import já existente de `@mypet/core/catalog`:

```ts
import { getProductCount, getCategories } from "@mypet/core/catalog";
```

Troque a assinatura do componente `Home` (linha 91 hoje) de:

```tsx
export default function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; brand?: string; page?: string }>;
}) {
  return (
```

para:

```tsx
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; brand?: string; page?: string }>;
}) {
  const categories = await getCategories();
  return (
```

E troque `<SiteNav />` (dentro do `<LeadGateProvider>`) por `<SiteNav categories={categories} />`.

- [ ] **Step 2: Aplicar exatamente a mesma mudança em `apps/distribuidora/app/page.tsx`** (mesmo import, mesma troca de assinatura para `async`, mesmo `<SiteNav categories={categories} />`).

- [ ] **Step 3: Atualizar `apps/mypet/app/produtos/[id]/page.tsx`**

No topo do arquivo, adicione `getCategories` ao import já existente de `@mypet/core/catalog`:

```ts
import { getProductById, getCategories } from "@mypet/core/catalog";
```

Troque a assinatura do componente `ProductPage` (linha 28 hoje) de:

```tsx
export default function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
```

para:

```tsx
export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const categories = await getCategories();
  return (
```

E troque `<SiteNav />` por `<SiteNav categories={categories} />`.

- [ ] **Step 4: Aplicar exatamente a mesma mudança em `apps/distribuidora/app/produtos/[id]/page.tsx`**.

- [ ] **Step 5: Rodar typecheck e confirmar que os erros da Task 6 (Step 2) desapareceram**

Run: `pnpm --filter mypet exec tsc --noEmit && pnpm --filter distribuidora exec tsc --noEmit`
Expected: PASS, sem erro de `Property 'categories' is missing` em nenhum dos 6 `page.tsx` (os 2 de `cotacao` já corrigidos na Task 7, os 4 desta tarefa).

- [ ] **Step 6: Commit**

```bash
git add apps/mypet/app/page.tsx apps/distribuidora/app/page.tsx apps/mypet/app/produtos/\[id\]/page.tsx apps/distribuidora/app/produtos/\[id\]/page.tsx
git commit -m "feat: home e pagina de produto passam categories pro SiteNav"
```

---

## Task 9: Criar `CategoryListing` (breadcrumb + chips + grade + paginação)

**Files:**
- Create: `packages/core/src/components/category-listing.tsx`

**Interfaces:**
- Consumes: `getCategories()`, `getCatalog()` (já existentes em `../catalog`), `collectCategorySubtreeIds`, `getCategoryPath`, `parsePage` (já existente) (`../catalog-utils`), `ProductCard` (já existente, `./product-card`).
- Produces: `CategoryListing({ slug, page, channel, palette }: { slug: string; page?: string; channel: string; palette: Palette })` (async server component) — consumido pela Task 10.

- [ ] **Step 1: Criar o componente**

Crie `packages/core/src/components/category-listing.tsx`:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCatalog, getCategories } from "../catalog";
import { parsePage, collectCategorySubtreeIds, getCategoryPath } from "../catalog-utils";
import { ProductCard } from "./product-card";
import type { Palette } from "../theme";

export async function CategoryListing({
  slug,
  page: pageRaw,
  channel,
  palette,
}: {
  slug: string;
  page?: string;
  channel: string;
  palette: Palette;
}) {
  const page = parsePage(pageRaw);
  const categories = await getCategories();
  const node = categories.find((c) => c.slug === slug);

  if (!node) {
    notFound();
  }

  const path = getCategoryPath(categories, node.id);
  const children = categories.filter((c) => c.parentId === node.id);
  const subtreeIds = collectCategorySubtreeIds(categories, node.id);
  const catalog = await getCatalog({ categoryId: subtreeIds, page, channel });

  return (
    <>
      <nav aria-label="Breadcrumb" style={{ marginBottom: 16 }}>
        <ol style={{ display: "flex", flexWrap: "wrap", gap: 6, listStyle: "none", margin: 0, padding: 0, fontSize: 13, color: palette.gray600 }}>
          <li>
            <Link href="/" style={{ color: palette.gray600, textDecoration: "none" }}>Início</Link>
          </li>
          {path.map((c, i) => (
            <li key={c.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span aria-hidden="true">/</span>
              {i === path.length - 1 ? (
                <span style={{ color: palette.navy, fontWeight: 700 }} aria-current="page">{c.name}</span>
              ) : (
                <Link href={`/categoria/${c.slug}`} style={{ color: palette.gray600, textDecoration: "none" }}>{c.name}</Link>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <h1 style={{ fontSize: 26, fontWeight: 900, color: palette.navy, marginBottom: 16 }}>{node.name}</h1>

      {children.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
          {children.map((child) => (
            <Link key={child.id} href={`/categoria/${child.slug}`} className="cat-btn" style={{ textDecoration: "none" }}>
              {child.name}
            </Link>
          ))}
        </div>
      )}

      <p style={{ fontSize: 14, color: palette.gray600, marginBottom: 20 }}>
        {catalog.total} produtos em {node.name}
      </p>

      {catalog.items.length === 0 ? (
        <p style={{ fontSize: 15, color: palette.gray600, padding: "40px 0", textAlign: "center" }}>
          Nenhum produto encontrado nesta categoria.
        </p>
      ) : (
        <div className="products-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: 22 }}>
          {catalog.items.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {catalog.totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 16, marginTop: 36 }}>
          {page > 1 ? (
            <Link href={`/categoria/${slug}?page=${page - 1}`} className="cat-btn">← Anterior</Link>
          ) : (
            <span className="cat-btn" style={{ opacity: 0.4, pointerEvents: "none" }} aria-disabled="true">← Anterior</span>
          )}
          <span style={{ fontSize: 14, color: palette.gray600 }}>Página {page} de {catalog.totalPages}</span>
          {page < catalog.totalPages ? (
            <Link href={`/categoria/${slug}?page=${page + 1}`} className="cat-btn">Próxima →</Link>
          ) : (
            <span className="cat-btn" style={{ opacity: 0.4, pointerEvents: "none" }} aria-disabled="true">Próxima →</span>
          )}
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `pnpm --filter mypet exec tsc --noEmit`
Expected: sem erro novo relacionado a `category-listing.tsx`.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/components/category-listing.tsx
git commit -m "feat: adiciona CategoryListing (breadcrumb, chips de refinamento e grade por categoria)"
```

---

## Task 10: Criar a rota `/categoria/[slug]` (× 2 apps)

**Files:**
- Create: `apps/mypet/app/categoria/[slug]/page.tsx`
- Create: `apps/distribuidora/app/categoria/[slug]/page.tsx`

**Interfaces:**
- Consumes: `CategoryListing` (Task 9), `SiteNav` (Task 6), `getCategories` (já existente).
- Produces: nada consumido por tarefas futuras.

- [ ] **Step 1: Criar `apps/mypet/app/categoria/[slug]/page.tsx`**

```tsx
import { Suspense } from "react";
import { getCategories } from "@mypet/core/catalog";
import { LeadGateProvider } from "@mypet/core/components/lead-gate";
import { CategoryListing } from "@mypet/core/components/category-listing";
import { SiteNav } from "@mypet/core/components/site-nav";
import { clientConfig } from "@/client.config";

const { palette: PALETTE } = clientConfig;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const categories = await getCategories();
  const node = categories.find((c) => c.slug === slug);
  if (!node) return { title: `Categoria não encontrada — ${clientConfig.name}` };

  return {
    title: `${node.name} — ${clientConfig.name} Atacado`,
    description: `Confira os produtos de ${node.name} no atacado B2B da ${clientConfig.name}. Preços sob consulta para lojistas.`,
  };
}

export default async function CategoriaPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const categories = await getCategories();
  const { slug } = await params;
  const { page } = await searchParams;

  return (
    <div style={{ fontFamily: "'Nunito', 'Nunito Sans', sans-serif", background: PALETTE.gray50, minHeight: "100vh", color: PALETTE.gray800 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Nunito+Sans:wght@400;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { margin: 0; }

        .cat-btn {
          padding: 8px 18px;
          border-radius: 100px;
          border: 1.5px solid ${PALETTE.gray200};
          background: ${PALETTE.white};
          color: ${PALETTE.gray600};
          font-family: 'Nunito', sans-serif;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .cat-btn:hover { border-color: ${PALETTE.pink}; color: ${PALETTE.pink}; }

        .product-card {
          background: ${PALETTE.white};
          border-radius: 16px;
          border: 1px solid ${PALETTE.gray200};
          overflow: hidden;
          transition: transform 0.2s, box-shadow 0.2s;
          cursor: pointer;
          display: flex;
          flex-direction: column;
        }
        .product-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 32px rgba(26,52,114,0.10);
        }

        .unlock-btn {
          width: 100%;
          padding: 11px 0;
          background: ${PALETTE.navy};
          color: ${PALETTE.white};
          border: none;
          border-radius: 10px;
          font-family: 'Nunito', sans-serif;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          letter-spacing: 0.01em;
        }
        .unlock-btn:hover { background: ${PALETTE.navyDark}; }
        .unlock-btn.revealed { background: ${PALETTE.green}; cursor: default; }

        .cta-primary {
          background: ${PALETTE.pink};
          color: ${PALETTE.white};
          border: none;
          border-radius: 100px;
          padding: 10px 22px;
          font-family: 'Nunito', sans-serif;
          font-size: 14px;
          font-weight: 800;
          cursor: pointer;
          transition: background 0.2s;
        }
        .cta-primary:hover { background: ${PALETTE.pinkDark}; }

        .modal-overlay {
          position: fixed; inset: 0;
          background: rgba(15,31,69,0.6);
          display: flex; align-items: center; justify-content: center;
          z-index: 999;
          padding: 16px;
        }
        .modal {
          background: ${PALETTE.white};
          border-radius: 20px;
          padding: 40px 36px;
          width: 100%;
          max-width: 440px;
        }
        .form-input {
          width: 100%;
          padding: 12px 16px;
          border: 1.5px solid ${PALETTE.gray200};
          border-radius: 10px;
          font-family: 'Nunito Sans', sans-serif;
          font-size: 15px;
          color: ${PALETTE.gray800};
          outline: none;
          transition: border-color 0.2s;
          margin-bottom: 12px;
        }
        .form-input:focus { border-color: ${PALETTE.pink}; }
        .form-submit {
          width: 100%;
          padding: 14px;
          background: ${PALETTE.pink};
          color: white;
          border: none;
          border-radius: 10px;
          font-family: 'Nunito', sans-serif;
          font-size: 16px;
          font-weight: 800;
          cursor: pointer;
          margin-top: 4px;
          transition: background 0.2s;
        }
        .form-submit:hover { background: ${PALETTE.pinkDark}; }

        @media (max-width: 640px) {
          .products-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 14px !important; }
          .product-card-media { aspect-ratio: 1 / 1.08 !important; }
          .modal { padding: 28px 20px; }
        }
      `}</style>

      <LeadGateProvider>
        <SiteNav categories={categories} />

        <main style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 24px 80px" }}>
          <Suspense fallback={<p style={{ color: PALETTE.gray600 }}>Carregando categoria…</p>}>
            <CategoryListing slug={slug} page={page} channel={clientConfig.catalogChannel} palette={PALETTE} />
          </Suspense>
        </main>

        <footer style={{ background: PALETTE.navyDark, padding: "32px 24px" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 20 }}>{clientConfig.logo.emoji}</span>
              <span style={{ color: "rgba(255,255,255,0.85)", fontWeight: 700, fontSize: 14 }}>{clientConfig.name} — {clientConfig.tagline}</span>
            </div>
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>© 2026 {clientConfig.name}. Todos os direitos reservados.</span>
          </div>
        </footer>
      </LeadGateProvider>
    </div>
  );
}
```

- [ ] **Step 2: Criar `apps/distribuidora/app/categoria/[slug]/page.tsx` com o mesmo conteúdo do Step 1**.

- [ ] **Step 3: Rodar typecheck**

Run: `pnpm --filter mypet exec tsc --noEmit && pnpm --filter distribuidora exec tsc --noEmit`
Expected: PASS, sem erros nas duas novas rotas.

- [ ] **Step 4: Rodar a suíte completa do core mais uma vez, pra garantir que nada foi quebrado ao longo de todas as tarefas anteriores**

Run: `pnpm --filter @mypet/core test`
Expected: PASS em todos os arquivos.

- [ ] **Step 5: Commit**

```bash
git add apps/mypet/app/categoria apps/distribuidora/app/categoria
git commit -m "feat: adiciona rota /categoria/[slug] nos dois apps"
```

---

## Task 11: Validação manual end-to-end via `/run`

**Files:** nenhum arquivo novo — só validação do que já foi implementado.

**Interfaces:** N/A.

- [ ] **Step 1: Subir o app `mypet` localmente**

Use a skill `/run` (ou `pnpm dev:mypet`) para iniciar `apps/mypet` e abrir no navegador.

- [ ] **Step 2: Validar desktop — hover e teclado**

- Passar o mouse sobre "Cães" (categoria com mais subcategorias) na barra do menu: o painel largura-total deve abrir com animação suave, mostrando as subcategorias de nível 2 em colunas, e o link "Ver todos os produtos de Cães" no topo.
- Passar o mouse sobre uma categoria sem subcategorias (ex.: "Kits"): deve navegar direto para `/categoria/kits` ao clicar, sem abrir painel.
- Focar a barra via `Tab` a partir do topo da página: confirmar que dá pra abrir o painel de "Cães" com `Enter`/`Espaço`, navegar pelas subcategorias com as setas, e fechar com `Esc` devolvendo o foco ao botão.

- [ ] **Step 3: Validar mobile — drawer e acordeão**

- Redimensionar a janela (ou usar o modo responsivo do DevTools) para menos de 768px de largura: a barra de categorias do desktop deve sumir e o botão ☰ deve aparecer ao lado do logo.
- Tocar/clicar no ☰: o drawer full-screen deve abrir com animação; tocar em "Cães" deve expandir o acordeão mostrando as subcategorias; tocar numa subcategoria deve navegar e fechar o drawer.
- Confirmar que tocar fora do drawer ou no × fecha o menu.

- [ ] **Step 4: Validar as páginas de categoria**

- Clicar numa subcategoria de nível 2 (ex.: "Ração" dentro de "Cães"): confirmar que `/categoria/caes-racao` carrega, o breadcrumb mostra "Início / Cães / Ração", e os produtos listados pertencem à subárvore certa.
- Se essa subcategoria tiver filhos de nível 3, confirmar que aparecem como chips de refinamento no topo e que clicar num chip filtra pra aquele nível 3 específico.
- Clicar em "Ver todos os produtos de Cães" no painel do desktop: confirmar que `/categoria/caes` mostra produtos de toda a subárvore (incluindo os de nível 2 e 3).
- Testar paginação numa categoria com mais de 24 produtos.
- Testar uma categoria sem produto nenhum (se houver): confirmar a mensagem de "Nenhum produto encontrado nesta categoria."

- [ ] **Step 5: Repetir os Steps 1-4 no app `distribuidora`**

Use `/run` (ou `pnpm dev:distribuidora`) e repita a validação — confirmar que o comportamento é idêntico, só trocando a paleta/nome do cliente.

- [ ] **Step 6: Confirmar que as páginas que não mudaram continuam funcionando**

Abrir a home, adicionar um produto ao carrinho, ir para `/cotacao` e confirmar que o fluxo de cotação (formulário, envio via WhatsApp) continua funcionando normalmente após a divisão em `cotacao-content.tsx` (Task 7).
