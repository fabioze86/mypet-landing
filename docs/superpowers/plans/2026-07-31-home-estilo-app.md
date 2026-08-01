# Home Estilo App (Mercado Livre / 99) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesenhar a home de `apps/distribuidora` e `apps/mypet` (hoje arquivos idênticos) para que categorias, banner promocional e início do catálogo de produtos apareçam na primeira dobra da tela no mobile, no estilo Mercado Livre/99, e dar um refresh visual em estatísticas, CTA final e footer.

**Architecture:** Três componentes novos e pequenos em `packages/core/src/components` (chips de categoria, banner compacto em carrossel, ícones de navegação rápida), reaproveitando dados e rotas já existentes (`getCategories`, `getBanners`, `/categoria/[slug]`). `hero-section.tsx` é removido. Os dois `page.tsx` (distribuidora e mypet) são reescritos com a nova ordem e o restante da página (stats/CTA/footer) redesenhado no mesmo arquivo, seguindo o padrão já usado ali (markup inline, sem extrair componente novo pra pedaço que já vivia inline).

**Tech Stack:** Next.js 16 App Router, React 19 (Server Components), TypeScript, Vitest (só para a função pura nova em `catalog-utils.ts` — não há infraestrutura de teste de componente React no repo, `vitest.config.ts` roda em `environment: "node"` e só inclui `*.test.ts`).

## Global Constraints

- Escopo travado em `apps/distribuidora/app/page.tsx` e `apps/mypet/app/page.tsx` — não mexer em `apps/azpetshop`, `apps/hub`, `apps/admin`, nem em outras rotas (produto, categoria, carrinho).
- Os 4 ícones de navegação rápida (Kits, Ofertas, Cupons, Fabricação Própria) não têm destino funcional nesta entrega — sem `href`, `opacity: 0.55` (decisão explícita do usuário).
- Sem bottom navigation fixa nesta entrega (decisão explícita do usuário — fica pra etapa futura).
- Fonte mantida: `Nunito`/`Nunito Sans` (sem mudança de tipografia).
- Footer mantém exatamente o mesmo conteúdo (logo, nome, tagline, copyright) — nenhum link ou dado novo (social, contato) que não exista hoje.
- `compact-banner.tsx` deve consumir **todos** os banners retornados por `getBanners(channel, "principal")`, não só o primeiro (bug do `hero-section.tsx` atual: `const [banner] = await getBanners(...)`).
- `apps/distribuidora/app/page.tsx` e `apps/mypet/app/page.tsx` devem permanecer byte-a-byte idênticos ao final (mesma convenção que já existe hoje).
- Sem testes automatizados de renderização de componente (não há `testing-library`/`jsdom` no projeto — `vitest.config.ts` usa `environment: "node"`, `include: ["src/**/*.test.ts"]`). A única lógica nova testável (`topLevelCategories`) ganha teste seguindo o padrão de `catalog-utils.test.ts`.

---

### Task 1: `topLevelCategories` em `catalog-utils.ts`

**Files:**
- Modify: `packages/core/src/catalog-utils.ts`
- Test: `packages/core/src/catalog-utils.test.ts`

**Interfaces:**
- Consumes: tipo `CategoryNode` já existente (`packages/core/src/catalog-utils.ts:17-24`: `{ id, parentId, slug, name, level, sortOrder }`).
- Produces: `topLevelCategories(categories: CategoryNode[]): CategoryNode[]`, consumida pela `Task 2` (`category-chips.tsx`).

- [ ] **Step 1: Escrever o teste (falhando)**

Adicionar ao final de `packages/core/src/catalog-utils.test.ts` (o arquivo já importa `type CategoryNode` e já define `SAMPLE_CATEGORIES` no topo — reaproveitar essa fixture, não duplicar):

```ts
describe("topLevelCategories", () => {
  it("retorna só as categorias de nível raiz (parentId null), preservando a ordem", () => {
    expect(topLevelCategories(SAMPLE_CATEGORIES)).toEqual([
      SAMPLE_CATEGORIES[0],
      SAMPLE_CATEGORIES[3],
    ]);
  });

  it("retorna lista vazia quando não há categorias de raiz", () => {
    const onlyChildren: CategoryNode[] = [
      { id: "x1", parentId: "root", slug: "x1", name: "X1", level: 2, sortOrder: 0 },
    ];
    expect(topLevelCategories(onlyChildren)).toEqual([]);
  });
});
```

Adicionar `topLevelCategories` à lista de imports no topo do arquivo (junto de `buildCategoryTree`, `collectCategorySubtreeIds`, etc):

```ts
import {
  parsePage,
  pageRange,
  totalPages,
  pickActiveBadge,
  mainImage,
  mapProduct,
  PLACEHOLDER_IMAGE,
  buildCategoryTree,
  collectCategorySubtreeIds,
  getCategoryPath,
  topLevelCategories,
  type RawProductRow,
  type CategoryNode,
} from "./catalog-utils";
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `cd packages/core && npx vitest run src/catalog-utils.test.ts`
Expected: FAIL — `topLevelCategories is not a function` (ou erro de import, já que a função ainda não existe em `catalog-utils.ts`).

- [ ] **Step 3: Implementar a função**

Adicionar em `packages/core/src/catalog-utils.ts`, logo após `buildCategoryTree` (linha ~150):

```ts
export function topLevelCategories(categories: CategoryNode[]): CategoryNode[] {
  return categories.filter((c) => c.parentId === null);
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `cd packages/core && npx vitest run src/catalog-utils.test.ts`
Expected: PASS — todos os testes do arquivo, incluindo os 2 novos de `topLevelCategories`.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/catalog-utils.ts packages/core/src/catalog-utils.test.ts
git commit -m "feat(core): adiciona topLevelCategories para filtrar categorias de raiz"
```

---

### Task 2: `category-chips.tsx`

**Files:**
- Create: `packages/core/src/components/category-chips.tsx`

**Interfaces:**
- Consumes: `topLevelCategories` (Task 1, `packages/core/src/catalog-utils.ts`); classe CSS `.cat-btn`/`.cat-btn.active` já existente e usada em `category-listing.tsx`/`catalog-section.tsx` (não recriar estilo, só reaproveitar a classe).
- Produces: componente `CategoryChips({ categories }: { categories: CategoryNode[] })`, consumido pela `Task 5`/`Task 6` (`page.tsx`). Depende de uma classe CSS `.chip-row` que será adicionada ao `<style>` de `page.tsx` na `Task 5`/`Task 6` — o componente em si não define CSS.

- [ ] **Step 1: Criar o componente**

```tsx
// packages/core/src/components/category-chips.tsx
import Link from "next/link";
import { topLevelCategories, type CategoryNode } from "../catalog-utils";

export function CategoryChips({ categories }: { categories: CategoryNode[] }) {
  const topLevel = topLevelCategories(categories);

  return (
    <div className="chip-row">
      <Link href="/" className="cat-btn active" style={{ textDecoration: "none" }}>
        Todas
      </Link>
      {topLevel.map((c) => (
        <Link key={c.id} href={`/categoria/${c.slug}`} className="cat-btn" style={{ textDecoration: "none" }}>
          {c.name}
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Checar tipos**

Run: `cd packages/core && npx tsc --noEmit`
Expected: sem erros relacionados a `category-chips.tsx`.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/components/category-chips.tsx
git commit -m "feat(core): adiciona componente CategoryChips (chips horizontais de categoria)"
```

---

### Task 3: `compact-banner.tsx`

**Files:**
- Create: `packages/core/src/components/compact-banner.tsx`

**Interfaces:**
- Consumes: `getBanners` já existente (`packages/core/src/banners.ts`, assinatura `getBanners(channel: Channel, type: BannerType, categoryId?: string): Promise<Banner[]>`); tipo `Palette` de `../theme`; tipo `Channel` de `../channels`.
- Produces: componente `CompactBanner({ channel, palette }: { channel: Channel; palette: Palette })` (`async`), consumido pela `Task 5`/`Task 6`. Depende das classes CSS `.banner-row`/`.banner-row-item` que serão adicionadas ao `<style>` de `page.tsx` na `Task 5`/`Task 6`.

- [ ] **Step 1: Criar o componente**

```tsx
// packages/core/src/components/compact-banner.tsx
import { getBanners } from "../banners";
import type { Palette } from "../theme";
import type { Channel } from "../channels";

export async function CompactBanner({ channel, palette }: { channel: Channel; palette: Palette }) {
  const banners = await getBanners(channel, "principal");

  if (banners.length === 0) {
    return <FallbackBanner palette={palette} />;
  }

  return (
    <div className="banner-row">
      {banners.map((b) => {
        const image = (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={b.imageUrl}
            alt={b.title ?? ""}
            style={{ height: 150, borderRadius: 14, objectFit: "cover", display: "block" }}
          />
        );
        return (
          <div key={b.id} className="banner-row-item">
            {b.linkUrl ? <a href={b.linkUrl}>{image}</a> : image}
          </div>
        );
      })}
    </div>
  );
}

function FallbackBanner({ palette }: { palette: Palette }) {
  return (
    <div className="banner-row">
      <div
        className="banner-row-item"
        style={{
          height: 150,
          minWidth: 280,
          borderRadius: 14,
          background: `linear-gradient(135deg, ${palette.navyDark} 0%, ${palette.navy} 60%, #1e4d8a 100%)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 24px",
        }}
      >
        <p style={{ color: palette.white, fontSize: 15, fontWeight: 800, textAlign: "center", lineHeight: 1.4 }}>
          Atacado exclusivo para pet shops. Preços sob consulta.
        </p>
      </div>
    </div>
  );
}
```

Note que este componente usa **todos** os itens de `banners` (`banners.map(...)`), diferente do `hero-section.tsx` atual que fazia `const [banner] = await getBanners(...)` e descartava o resto — isso é intencional (ver Global Constraints).

- [ ] **Step 2: Checar tipos**

Run: `cd packages/core && npx tsc --noEmit`
Expected: sem erros relacionados a `compact-banner.tsx`.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/components/compact-banner.tsx
git commit -m "feat(core): adiciona componente CompactBanner (carrossel horizontal baixo)"
```

---

### Task 4: `quick-nav-icons.tsx`

**Files:**
- Create: `packages/core/src/components/quick-nav-icons.tsx`

**Interfaces:**
- Consumes: tipo `Palette` de `../theme`.
- Produces: componente `QuickNavIcons({ palette }: { palette: Palette })`, consumido pela `Task 5`/`Task 6`.

- [ ] **Step 1: Criar o componente**

```tsx
// packages/core/src/components/quick-nav-icons.tsx
import type { Palette } from "../theme";

const ITEMS = [
  { icon: "📦", label: "Kits" },
  { icon: "🏷️", label: "Ofertas" },
  { icon: "🎟️", label: "Cupons" },
  { icon: "🏭", label: "Fabricação Própria" },
];

export function QuickNavIcons({ palette }: { palette: Palette }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-around", padding: "12px 16px 4px" }}>
      {ITEMS.map((item) => (
        <div
          key={item.label}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, opacity: 0.55, maxWidth: 76 }}
        >
          <span style={{ fontSize: 24 }}>{item.icon}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: palette.gray600, textAlign: "center", lineHeight: 1.2 }}>
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Checar tipos**

Run: `cd packages/core && npx tsc --noEmit`
Expected: sem erros relacionados a `quick-nav-icons.tsx`.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/components/quick-nav-icons.tsx
git commit -m "feat(core): adiciona componente QuickNavIcons (placeholder, sem destino)"
```

---

### Task 5: Reescrever `apps/distribuidora/app/page.tsx`

**Files:**
- Modify: `apps/distribuidora/app/page.tsx` (reescrita completa)

**Interfaces:**
- Consumes: `CategoryChips` (Task 2), `CompactBanner` (Task 3), `QuickNavIcons` (Task 4), `MiniBannerStrip`/`CatalogSection`/`AssistantSearch`/`SiteNav`/`LeadGateProvider`/`UnlockButton` (já existentes, sem mudança de assinatura).
- Produces: nova ordem de página, consumida apenas pelo Next.js (rota `/`). Não deleta `HeroSection` daqui — a remoção do arquivo `hero-section.tsx` é a `Task 7`, depois que os dois `page.tsx` já não o importam mais.

- [ ] **Step 1: Substituir o conteúdo completo do arquivo**

Conteúdo atual de `apps/distribuidora/app/page.tsx` — 346 linhas, com `HeroSection` importado de `@mypet/core/components/hero-section`, hero grande de texto, `AssistantSearch` logo após o hero, stats com borda divisória e padding 28px, CTA com padding 64px, footer em `flex-wrap` de uma linha só, e CSS incluindo `.hero-title` e `.fade-up*` (usados só pelo `HeroSection` que está sendo removido).

Novo conteúdo completo:

```tsx
import { Suspense } from "react";
import type { Palette } from "@mypet/core/theme";
import type { Channel } from "@mypet/core/channels";
import { LeadGateProvider, UnlockButton } from "@mypet/core/components/lead-gate";
import { CatalogSection } from "@mypet/core/components/catalog-section";
import { getProductCount, getCategories } from "@mypet/core/catalog";
import { SiteNav } from "@mypet/core/components/site-nav";
import { AssistantSearch } from "@mypet/core/components/assistant-search";
import { CategoryChips } from "@mypet/core/components/category-chips";
import { CompactBanner } from "@mypet/core/components/compact-banner";
import { QuickNavIcons } from "@mypet/core/components/quick-nav-icons";
import { MiniBannerStrip } from "@mypet/core/components/mini-banner-strip";
import { clientConfig } from "@/client.config";

const { palette: PALETTE } = clientConfig;

const STATS_STATIC = [
  { icon: "🏪", value: "10.000+", label: "Pet shops ativos" },
  { icon: "📦", value: "…", label: "SKUs no catálogo" },
  { icon: "🚚", value: "48h", label: "Entrega média SP" },
  { icon: "✅", value: "R$0", label: "Taxa de cadastro" },
];

async function StatsCount({ channel }: { channel: string }) {
  const total = await getProductCount(channel);
  const totalLabel = `${total.toLocaleString("pt-BR")}+`;
  const STATS = [
    { icon: "🏪", value: "10.000+", label: "Pet shops ativos" },
    { icon: "📦", value: totalLabel, label: "SKUs no catálogo" },
    { icon: "🚚", value: "48h", label: "Entrega média SP" },
    { icon: "✅", value: "R$0", label: "Taxa de cadastro" },
  ];
  return (
    <>
      {STATS.map((s) => (
        <div key={s.label} style={{ padding: "16px 12px", textAlign: "center" }}>
          <div style={{ fontSize: 18, marginBottom: 4 }}>{s.icon}</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: PALETTE.pink, marginBottom: 2 }}>{s.value}</div>
          <div style={{ fontSize: 12, color: PALETTE.gray600, fontWeight: 600 }}>{s.label}</div>
        </div>
      ))}
    </>
  );
}

async function CatalogContent({
  q,
  brand,
  page,
  channel,
  palette,
}: {
  q?: string;
  brand?: string;
  page?: string;
  channel: string;
  palette: Palette;
}) {
  const total = await getProductCount(channel);
  const totalLabel = `${total.toLocaleString("pt-BR")}+`;
  return (
    <>
      <p style={{ fontSize: 14, color: PALETTE.gray600, marginBottom: 20 }}>
        Mais de {totalLabel} produtos disponíveis no atacado
      </p>
      <CatalogSection q={q} brand={brand} page={page} channel={channel} palette={palette} />
    </>
  );
}

async function DynamicCatalog({
  searchParams,
  channel,
  palette,
}: {
  searchParams: Promise<{ q?: string; brand?: string; page?: string }>;
  channel: string;
  palette: Palette;
}) {
  const sp = await searchParams;
  return (
    <section id="catalogo" style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 24px 80px" }}>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 24, fontWeight: 900, color: PALETTE.navy, marginBottom: 4 }}>Catálogo completo</h2>
      </div>
      <Suspense fallback={<p style={{ color: PALETTE.gray600 }}>Carregando catálogo…</p>}>
        <CatalogContent q={sp.q} brand={sp.brand} page={sp.page} channel={channel} palette={palette} />
      </Suspense>
    </section>
  );
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; brand?: string; page?: string }>;
}) {
  const categories = await getCategories();
  return (
    <div style={{ fontFamily: "'Nunito', 'Nunito Sans', sans-serif", background: PALETTE.gray50, minHeight: "100vh", color: PALETTE.gray800 }}>

      {/* GOOGLE FONTS */}
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
        .cat-btn.active {
          background: ${PALETTE.pink};
          border-color: ${PALETTE.pink};
          color: ${PALETTE.white};
        }

        .chip-row {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding: 10px 16px;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }
        .chip-row::-webkit-scrollbar { display: none; }

        .banner-row {
          display: flex;
          gap: 10px;
          overflow-x: auto;
          padding: 0 16px;
          scroll-snap-type: x mandatory;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }
        .banner-row::-webkit-scrollbar { display: none; }
        .banner-row-item { scroll-snap-align: start; flex: 0 0 auto; }
        .banner-row-item img { min-width: 280px; }

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
        .unlock-btn.revealed {
          background: ${PALETTE.green};
          cursor: default;
        }

        .cta-primary {
          background: ${PALETTE.pink};
          color: ${PALETTE.white};
          border: none;
          border-radius: 100px;
          padding: 16px 36px;
          font-family: 'Nunito', sans-serif;
          font-size: 16px;
          font-weight: 800;
          cursor: pointer;
          transition: background 0.2s, transform 0.15s;
        }
        .cta-primary:hover { background: ${PALETTE.pinkDark}; transform: scale(1.03); }

        .cta-secondary {
          background: transparent;
          color: ${PALETTE.white};
          border: 2px solid rgba(255,255,255,0.5);
          border-radius: 100px;
          padding: 14px 32px;
          font-family: 'Nunito', sans-serif;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: border-color 0.2s, background 0.2s;
        }
        .cta-secondary:hover { border-color: white; background: rgba(255,255,255,0.12); }

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

        .footer-row {
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
        }

        @media (max-width: 640px) {
          .stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .products-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 14px !important; }
          .product-card-media { aspect-ratio: 1 / 1.08 !important; }
          .modal { padding: 28px 20px; }
          .footer-row { flex-direction: column; align-items: flex-start; }
        }
      `}</style>

      <LeadGateProvider>

        {/* NAV */}
        <SiteNav categories={categories} />

        {/* CATEGORY CHIPS */}
        <CategoryChips categories={categories} />

        {/* COMPACT BANNER */}
        <Suspense fallback={<div style={{ height: 150, margin: "0 16px" }} />}>
          <CompactBanner channel={clientConfig.catalogChannel as Channel} palette={PALETTE} />
        </Suspense>

        {/* QUICK NAV ICONS */}
        <QuickNavIcons palette={PALETTE} />

        {/* MINI BANNER STRIP */}
        <Suspense fallback={null}>
          <MiniBannerStrip channel={clientConfig.catalogChannel as Channel} />
        </Suspense>

        {/* CATALOG */}
        <Suspense fallback={
          <section style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 24px 80px" }}>
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 24, fontWeight: 900, color: PALETTE.navy, marginBottom: 4 }}>Catálogo completo</h2>
            </div>
            <p style={{ color: PALETTE.gray600 }}>Carregando catálogo…</p>
          </section>
        }>
          <DynamicCatalog searchParams={searchParams} channel={clientConfig.catalogChannel} palette={clientConfig.palette} />
        </Suspense>

        {/* ASSISTENTE DE BUSCA COM IA */}
        <div style={{ padding: "0 24px", marginTop: 8 }}>
          <AssistantSearch channel={clientConfig.catalogChannel} palette={clientConfig.palette} />
        </div>

        {/* STATS */}
        <section style={{ background: PALETTE.white, borderBottom: `1px solid ${PALETTE.gray200}`, marginTop: 32 }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
            <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0 }}>
              <Suspense fallback={
                <>
                  {STATS_STATIC.map((s) => (
                    <div key={s.label} style={{ padding: "16px 12px", textAlign: "center" }}>
                      <div style={{ fontSize: 18, marginBottom: 4 }}>{s.icon}</div>
                      <div style={{ fontSize: 20, fontWeight: 900, color: PALETTE.pink, marginBottom: 2 }}>{s.value}</div>
                      <div style={{ fontSize: 12, color: PALETTE.gray600, fontWeight: 600 }}>{s.label}</div>
                    </div>
                  ))}
                </>
              }>
                <StatsCount channel={clientConfig.catalogChannel} />
              </Suspense>
            </div>
          </div>
        </section>

        {/* CTA BANNER */}
        <section style={{
          background: `linear-gradient(135deg, ${PALETTE.pink} 0%, ${PALETTE.pinkDark} 100%)`,
          padding: "44px 24px",
        }}>
          <div style={{ maxWidth: 680, margin: "0 auto", textAlign: "center" }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: "rgba(255,255,255,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 26, margin: "0 auto 16px",
            }}>🐾</div>
            <h2 style={{ fontSize: 28, fontWeight: 900, color: PALETTE.white, marginBottom: 12 }}>
              Pronto para comprar no atacado?
            </h2>
            <p style={{ fontSize: 15, color: "rgba(255,255,255,0.82)", marginBottom: 28, lineHeight: 1.6 }}>
              Mais de 10.000 pet shops já compram pela My Pet Brasil. Cadastro gratuito, sem burocracia e cotações sob consulta.
            </p>
            <UnlockButton className="cta-secondary" style={{ fontSize: 16 }}>
              Solicitar cotação agora
            </UnlockButton>
          </div>
        </section>

        {/* FOOTER */}
        <footer style={{ background: PALETTE.navyDark, padding: "24px 24px calc(24px + env(safe-area-inset-bottom))" }}>
          <div className="footer-row">
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

- [ ] **Step 2: Checar tipos**

Run: `cd apps/distribuidora && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/distribuidora/app/page.tsx
git commit -m "feat(distribuidora): redesenha home no estilo Mercado Livre/99"
```

---

### Task 6: Reescrever `apps/mypet/app/page.tsx`

**Files:**
- Modify: `apps/mypet/app/page.tsx` (reescrita completa, conteúdo idêntico ao resultado da Task 5)

**Interfaces:**
- Mesmas da Task 5 — `@/client.config` resolve para `apps/mypet/client.config.ts` (path alias por app), o restante dos imports (`@mypet/core/*`) é o mesmo pacote compartilhado.

- [ ] **Step 1: Substituir o conteúdo completo do arquivo**

`apps/mypet/app/page.tsx` hoje é **byte-a-byte idêntico** a `apps/distribuidora/app/page.tsx` antes da Task 5 (confirmado via `diff`). Aplicar exatamente o mesmo conteúdo novo escrito no Step 1 da Task 5, substituindo o conteúdo completo deste arquivo.

- [ ] **Step 2: Confirmar que os dois arquivos continuam idênticos**

Run: `diff apps/distribuidora/app/page.tsx apps/mypet/app/page.tsx`
Expected: nenhuma saída (arquivos idênticos).

- [ ] **Step 3: Checar tipos**

Run: `cd apps/mypet && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add apps/mypet/app/page.tsx
git commit -m "feat(mypet): redesenha home no estilo Mercado Livre/99"
```

---

### Task 7: Remover `hero-section.tsx` e verificação final

**Files:**
- Delete: `packages/core/src/components/hero-section.tsx`

**Interfaces:**
- Consumes: nada — esta task só confirma que nenhum arquivo importa mais `hero-section.tsx` (Tasks 5 e 6 já removeram as duas únicas referências) antes de deletar.

- [ ] **Step 1: Confirmar que não há mais referências**

Run: `grep -rln "hero-section" apps packages --include="*.tsx" --include="*.ts"`
Expected: nenhuma saída (nenhum arquivo referencia mais `hero-section`).

- [ ] **Step 2: Remover o arquivo**

```bash
git rm packages/core/src/components/hero-section.tsx
```

- [ ] **Step 3: Rodar a suíte de testes completa**

Run: `npm run test`
Expected: todos os testes passando, incluindo os 2 novos de `topLevelCategories` (Task 1). Nenhuma referência quebrada a `hero-section`.

- [ ] **Step 4: Checar tipos nos dois apps**

Run: `cd apps/distribuidora && npx tsc --noEmit && cd ../mypet && npx tsc --noEmit`
Expected: sem erros em nenhum dos dois.

- [ ] **Step 5: Verificação manual — build e visual mobile**

Run: `cd apps/distribuidora && npm run build`
Expected: build de produção completa sem erro.

Rodar `npm run dev` (ou `npm run start` após o build) e abrir `http://localhost:4101` no DevTools com viewport mobile (375×667, ou o dispositivo real). Confirmar visualmente:
- Chips de categoria aparecem logo abaixo do header, roláveis horizontalmente, "Todas" ativo.
- Banner compacto (~150px de altura) aparece logo abaixo dos chips — se não houver banner "principal" cadastrado no Supabase para o canal, confirmar que aparece o `FallbackBanner` (gradiente navy/pink) na mesma altura, não o hero antigo.
- Os 4 ícones de navegação (Kits, Ofertas, Cupons, Fabricação Própria) aparecem entre o banner e a tira de mini-banners, visualmente esmaecidos (placeholder).
- Rolando a tela, o início do grid de produtos (foto + título + preço) já é visível dentro de ~1 tela de altura (sem precisar rolar múltiplas telas).
- Estatísticas, CTA final e footer aparecem mais abaixo, com o novo visual compacto (ícone + número menor nas estatísticas, padding reduzido no CTA, footer em duas linhas no mobile).

Repetir a mesma checagem em `apps/mypet` (`npm run dev` na porta configurada do app).

Se qualquer verificação (Steps 3-5) falhar, voltar à task correspondente (1-6), corrigir, e repetir antes de commitar.

- [ ] **Step 6: Commit**

```bash
git commit -m "chore(core): remove hero-section.tsx (substituido por compact-banner)"
```
