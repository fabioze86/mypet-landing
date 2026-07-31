# PWA Instalável — apps/distribuidora Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar `apps/distribuidora` instalável como PWA no Android/Chrome (manifest + service worker mínimo sem cache + banner de instalação customizado), sem tocar em outros apps ou em `packages/core`.

**Architecture:** Manifest via convenção de arquivo `app/manifest.ts` (auto-servido e auto-linkado pelo Next 16), ícones em `public/icons/` referenciados pelo manifest e `app/apple-icon.png` auto-detectado; um service worker mínimo (sem lógica de cache) satisfaz o critério de instalabilidade do Chrome; dois client components (`register-sw.tsx`, `install-prompt.tsx`) montados em `layout.tsx` cuidam do registro do SW e do convite de instalação via `beforeinstallprompt`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, sem dependências novas (service worker escrito à mão, ícones gerados via script Node puro usando só `zlib`/`fs` nativos).

## Global Constraints

- Escopo travado em `apps/distribuidora/` — não editar `packages/core` nem outros apps (spec, seção "Fora do escopo").
- Nenhuma dependência nova no `package.json` (decisão da Abordagem A — service worker sem Workbox).
- Service worker não deve interceptar/cachear nenhuma resposta — todo `fetch` segue direto pra rede (spec, "Tratamento de erro" + "sw.js").
- Cores e nome do manifest vêm de `apps/distribuidora/client.config.ts` (`clientConfig.name`, `palette.navy = "#0F172A"`), não hardcoded fora desse arquivo de config quando o componente puder ler via `useClientConfig()`.
- Sem testes automatizados (spec, seção "Testes / verificação") — verificação é manual/funcional (build de produção + inspeção).
- Ícones são placeholder explícito (fundo navy + pata), a serem substituídos quando houver arte final.

---

### Task 1: Script gerador de ícones placeholder

**Files:**
- Create: `apps/distribuidora/scripts/generate-pwa-icons.mjs`
- Create (gerados pelo script, não escritos à mão): `apps/distribuidora/public/icons/icon-192.png`, `apps/distribuidora/public/icons/icon-512.png`, `apps/distribuidora/public/icons/icon-maskable-512.png`, `apps/distribuidora/app/apple-icon.png`

**Interfaces:**
- Produces: 3 PNGs em `apps/distribuidora/public/icons/`, consumidos por `app/manifest.ts` (Task 2); e `apps/distribuidora/app/apple-icon.png`, que o Next.js 16 detecta automaticamente por convenção de arquivo e injeta sozinho a tag `<link rel="apple-touch-icon">` — não precisa de referência manual em nenhum outro arquivo (confirmado em `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/app-icons.md`).

- [ ] **Step 1: Escrever o script gerador**

Cria um encoder PNG mínimo (só `zlib`/`fs` nativos do Node, sem dependência nova) e desenha um quadrado navy sólido com uma pata branca simplificada (4 dedos + 1 almofada), em 4 tamanhos.

```js
// apps/distribuidora/scripts/generate-pwa-icons.mjs
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = join(__dirname, "..", "public", "icons");
const APP_DIR = join(__dirname, "..", "app");

const NAVY = [0x0f, 0x17, 0x2a]; // #0F172A
const WHITE = [0xff, 0xff, 0xff];

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr = chunk("IHDR", ihdrData);

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter type 0 (none) per scanline
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = chunk("IDAT", deflateSync(raw));

  const iend = chunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function setPixel(rgba, width, x, y, [r, g, b], alpha = 255) {
  if (x < 0 || y < 0 || x >= width) return;
  const i = (y * width + x) * 4;
  rgba[i] = r;
  rgba[i + 1] = g;
  rgba[i + 2] = b;
  rgba[i + 3] = alpha;
}

function inEllipse(px, py, cx, cy, rx, ry) {
  const dx = (px - cx) / rx;
  const dy = (py - cy) / ry;
  return dx * dx + dy * dy <= 1;
}

function drawPawIcon(size, { padScale = 0.8 } = {}) {
  const rgba = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      setPixel(rgba, size, x, y, NAVY);
    }
  }

  const cx = size / 2;
  const cy = size / 2;
  const unit = size * padScale;

  const pad = { cx, cy: cy + unit * 0.14, rx: unit * 0.22, ry: unit * 0.17 };
  const toeRy = unit * 0.09;
  const toeRx = unit * 0.075;
  const toes = [
    { cx: cx - unit * 0.19, cy: cy - unit * 0.14 },
    { cx: cx - unit * 0.065, cy: cy - unit * 0.22 },
    { cx: cx + unit * 0.065, cy: cy - unit * 0.22 },
    { cx: cx + unit * 0.19, cy: cy - unit * 0.14 },
  ];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let isWhite = inEllipse(x, y, pad.cx, pad.cy, pad.rx, pad.ry);
      if (!isWhite) {
        for (const toe of toes) {
          if (inEllipse(x, y, toe.cx, toe.cy, toeRx, toeRy)) {
            isWhite = true;
            break;
          }
        }
      }
      if (isWhite) setPixel(rgba, size, x, y, WHITE);
    }
  }

  return rgba;
}

function readPngSize(buf) {
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

mkdirSync(ICONS_DIR, { recursive: true });

const targets = [
  { dir: ICONS_DIR, file: "icon-192.png", size: 192, padScale: 0.8 },
  { dir: ICONS_DIR, file: "icon-512.png", size: 512, padScale: 0.8 },
  { dir: ICONS_DIR, file: "icon-maskable-512.png", size: 512, padScale: 0.6 }, // safe zone maior p/ maskable
  { dir: APP_DIR, file: "apple-icon.png", size: 180, padScale: 0.8 }, // convencao de arquivo do Next (auto-link)
];

for (const { dir, file, size, padScale } of targets) {
  const rgba = drawPawIcon(size, { padScale });
  const png = encodePng(size, size, rgba);
  const outPath = join(dir, file);
  writeFileSync(outPath, png);
  const { width, height } = readPngSize(png);
  if (width !== size || height !== size) {
    throw new Error(`Dimensao invalida gerada para ${file}: ${width}x${height}`);
  }
  console.log(`OK  ${file}  ${width}x${height}  ${png.length} bytes`);
}
```

- [ ] **Step 2: Rodar o script**

Run: `node apps/distribuidora/scripts/generate-pwa-icons.mjs`

Expected (4 linhas, uma por ícone, bytes > 0):
```
OK  icon-192.png  192x192  <N> bytes
OK  icon-512.png  512x512  <N> bytes
OK  icon-maskable-512.png  512x512  <N> bytes
OK  apple-icon.png  180x180  <N> bytes
```

- [ ] **Step 3: Verificar os arquivos no disco**

Run: `ls -la apps/distribuidora/public/icons/ apps/distribuidora/app/apple-icon.png`
Expected: os 3 arquivos `.png` em `public/icons/` e o `apple-icon.png` em `app/`, cada um com tamanho de arquivo maior que 0.

- [ ] **Step 4: Commit**

```bash
git add apps/distribuidora/scripts/generate-pwa-icons.mjs apps/distribuidora/public/icons/ apps/distribuidora/app/apple-icon.png
git commit -m "feat(distribuidora): gera icones placeholder do PWA"
```

---

### Task 2: `app/manifest.ts`

Esta versão do Next.js (16.2.6) suporta a convenção de arquivo `app/manifest.ts`: um arquivo que exporta uma função retornando `MetadataRoute.Manifest`, servido e linkado automaticamente pelo framework — sem precisar de `public/manifest.json` nem de tag `<link rel="manifest">` manual (confirmado em `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/manifest.md`). É o mesmo padrão de convenção de arquivo já usado no repo em `app/sitemap.ts`.

**Files:**
- Create: `apps/distribuidora/app/manifest.ts`

**Interfaces:**
- Consumes: `clientConfig` de `@/client.config` (`clientConfig.name`, `clientConfig.palette.navy`); ícones de `Task 1` (`/icons/icon-192.png`, `/icons/icon-512.png`, `/icons/icon-maskable-512.png`).
- Produces: manifest servido automaticamente pelo Next (rota gerada, sem necessidade de referência manual em `layout.tsx`).

- [ ] **Step 1: Criar o manifest**

```ts
// apps/distribuidora/app/manifest.ts
import type { MetadataRoute } from "next";
import { clientConfig } from "@/client.config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: clientConfig.name,
    short_name: "Distribuidora",
    description: "Catálogo de atacado para pet shops e distribuidores",
    start_url: "/",
    display: "standalone",
    background_color: clientConfig.palette.navy,
    theme_color: clientConfig.palette.navy,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
```

- [ ] **Step 2: Checar tipos**

Run: `cd apps/distribuidora && npx tsc --noEmit`
Expected: sem erros relacionados a `app/manifest.ts`.

- [ ] **Step 3: Commit**

```bash
git add apps/distribuidora/app/manifest.ts
git commit -m "feat(distribuidora): adiciona manifest do PWA via convencao app/manifest.ts"
```

---

### Task 3: Service worker mínimo (`public/sw.js`)

**Files:**
- Create: `apps/distribuidora/public/sw.js`

**Interfaces:**
- Produces: `/sw.js`, registrado por `register-sw.tsx` na `Task 4`.

- [ ] **Step 1: Criar o service worker**

```js
// apps/distribuidora/public/sw.js
// Service worker minimo: existe apenas para satisfazer o criterio de
// instalabilidade do Chrome. Nao intercepta nem cacheia nenhuma resposta -
// toda requisicao segue direto para a rede.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Intencionalmente vazio: nao intercepta a resposta, so a rede responde.
});
```

- [ ] **Step 2: Validar sintaxe**

Run: `node --check apps/distribuidora/public/sw.js`
Expected: nenhuma saída (exit code 0 = sintaxe válida).

- [ ] **Step 3: Commit**

```bash
git add apps/distribuidora/public/sw.js
git commit -m "feat(distribuidora): adiciona service worker minimo do PWA"
```

---

### Task 4: `register-sw.tsx`

**Files:**
- Create: `apps/distribuidora/app/components/register-sw.tsx`

**Interfaces:**
- Consumes: `/sw.js` (Task 3).
- Produces: componente `RegisterSW` (default export), montado em `layout.tsx` na `Task 6`. Não recebe props, não renderiza nada visível (`return null`).

- [ ] **Step 1: Criar o componente**

```tsx
// apps/distribuidora/app/components/register-sw.tsx
"use client";

import { useEffect } from "react";

export default function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Falha silenciosa: o site continua funcionando normalmente como
      // pagina comum, com ou sem os recursos de PWA disponiveis.
    });
  }, []);

  return null;
}
```

- [ ] **Step 2: Checar tipos**

Run: `cd apps/distribuidora && npx tsc --noEmit`
Expected: sem erros relacionados a `register-sw.tsx` (erros pré-existentes de outros arquivos, se houver, não são escopo desta task).

- [ ] **Step 3: Commit**

```bash
git add apps/distribuidora/app/components/register-sw.tsx
git commit -m "feat(distribuidora): registra service worker em producao"
```

---

### Task 5: `install-prompt.tsx`

**Files:**
- Create: `apps/distribuidora/app/components/install-prompt.tsx`

**Interfaces:**
- Consumes: `useClientConfig` de `@mypet/core/theme` (já usado em `layout.tsx:35`), especificamente `clientConfig.name` e `clientConfig.palette.navy`.
- Produces: componente `InstallPrompt` (default export), montado em `layout.tsx` na `Task 6`. Não recebe props.

- [ ] **Step 1: Criar o componente**

```tsx
// apps/distribuidora/app/components/install-prompt.tsx
"use client";

import { useEffect, useState } from "react";
import { useClientConfig } from "@mypet/core/theme";

const DISMISS_KEY = "mypet_pwa_install_dismissed_at";
const DISMISS_DAYS = 7;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches;
}

function isDismissedRecently(): boolean {
  let raw: string | null;
  try {
    raw = localStorage.getItem(DISMISS_KEY);
  } catch {
    return false;
  }
  if (!raw) return false;
  const dismissedAt = Number(raw);
  if (Number.isNaN(dismissedAt)) return false;
  const daysSince = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
  return daysSince < DISMISS_DAYS;
}

function markDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // localStorage indisponivel: banner pode reaparecer, sem problema.
  }
}

export default function InstallPrompt() {
  const clientConfig = useClientConfig();
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (isStandalone() || isDismissedRecently()) return;

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setDeferredEvent(event as BeforeInstallPromptEvent);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  if (!deferredEvent) return null;

  async function handleInstall() {
    if (!deferredEvent) return;
    await deferredEvent.prompt();
    await deferredEvent.userChoice;
    setDeferredEvent(null);
  }

  function handleDismiss() {
    markDismissed();
    setDeferredEvent(null);
  }

  return (
    <div
      role="dialog"
      aria-label="Instalar aplicativo"
      style={{ background: clientConfig.palette.navy }}
      className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-between gap-4 px-4 py-3 text-white shadow-lg"
    >
      <span className="text-sm">
        Adicione {clientConfig.name} à tela inicial para acessar mais rápido.
      </span>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={handleInstall}
          className="rounded bg-white px-3 py-1.5 text-sm font-medium text-slate-900"
        >
          Instalar
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Fechar"
          className="px-2 py-1.5 text-lg leading-none text-white/80"
        >
          ×
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Checar tipos**

Run: `cd apps/distribuidora && npx tsc --noEmit`
Expected: sem erros relacionados a `install-prompt.tsx`.

- [ ] **Step 3: Commit**

```bash
git add apps/distribuidora/app/components/install-prompt.tsx
git commit -m "feat(distribuidora): adiciona banner de instalacao do PWA"
```

---

### Task 6: Ligar tudo em `layout.tsx`

**Files:**
- Modify: `apps/distribuidora/app/layout.tsx`

**Interfaces:**
- Consumes: `RegisterSW` (Task 4, `apps/distribuidora/app/components/register-sw.tsx`), `InstallPrompt` (Task 5, `apps/distribuidora/app/components/install-prompt.tsx`). Não referencia `app/manifest.ts` (Task 2) nem `app/apple-icon.png` (Task 1) diretamente — o Next.js os detecta e linka sozinho por convenção de arquivo.

- [ ] **Step 1: Editar o layout**

Estado atual de `apps/distribuidora/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClientConfigProvider } from "@mypet/core/theme";
import { CartProvider } from "@mypet/core/components/cart-provider";
import { clientConfig } from "@/client.config";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: `${clientConfig.name} — ${clientConfig.tagline}`,
  description:
    "Catálogo de atacado para pet shops e distribuidores. Cadastro gratuito, cotações sob consulta.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ClientConfigProvider config={clientConfig}>
          <CartProvider>{children}</CartProvider>
        </ClientConfigProvider>
      </body>
    </html>
  );
}
```

Novo conteúdo completo:

```tsx
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClientConfigProvider } from "@mypet/core/theme";
import { CartProvider } from "@mypet/core/components/cart-provider";
import { clientConfig } from "@/client.config";
import RegisterSW from "./components/register-sw";
import InstallPrompt from "./components/install-prompt";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: `${clientConfig.name} — ${clientConfig.tagline}`,
  description:
    "Catálogo de atacado para pet shops e distribuidores. Cadastro gratuito, cotações sob consulta.",
  appleWebApp: {
    capable: true,
    title: clientConfig.name,
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: clientConfig.palette.navy,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ClientConfigProvider config={clientConfig}>
          <CartProvider>{children}</CartProvider>
          <RegisterSW />
          <InstallPrompt />
        </ClientConfigProvider>
      </body>
    </html>
  );
}
```

Nota: não é preciso referenciar `manifest` nem `icons.apple` aqui — o Next.js 16 detecta `app/manifest.ts` (Task 2) e `app/apple-icon.png` (Task 1) por convenção de arquivo e injeta as tags `<link rel="manifest">` e `<link rel="apple-touch-icon">` sozinho. `appleWebApp` continua manual porque controla meta tags diferentes (modo standalone no iOS, cor da status bar), não cobertas pelas convenções de arquivo. `viewport.themeColor` usa o export dedicado `Viewport`, exigido desde o Next 15 (não faz mais parte de `Metadata`).

- [ ] **Step 2: Checar tipos**

Run: `cd apps/distribuidora && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/distribuidora/app/layout.tsx
git commit -m "feat(distribuidora): conecta manifest, service worker e banner de instalacao no layout"
```

---

### Task 7: Verificação manual de instalabilidade

**Files:**
- Nenhum arquivo novo — apenas execução e checagem manual.

**Interfaces:**
- Consumes: build de produção completo de `apps/distribuidora` (Tasks 1–6).

- [ ] **Step 1: Build de produção**

Run: `cd apps/distribuidora && npm run build`
Expected: build finaliza sem erros (`Compiled successfully` ou equivalente da versão do Next em uso).

- [ ] **Step 2: Subir em modo produção**

Run: `cd apps/distribuidora && npm run start` (porta configurada em `package.json`, `next start` na porta padrão — se necessário, usar `-p 4101` para bater com o script `dev`)
Expected: servidor sobe sem erro, acessível em `http://localhost:4101` (ou porta usada).

- [ ] **Step 3: Checagem manual no navegador**

Abrir `http://localhost:4101` no Chrome desktop, abrir DevTools → aba Application:
- Em "Manifest": nome, ícones e cores gerados por `app/manifest.ts` aparecem carregados sem erro, e o ícone `apple-icon.png` aparece referenciado no `<head>` da página (Elements → `<link rel="apple-touch-icon">`).
- Em "Service Workers": `sw.js` aparece registrado e ativado ("activated and is running").

Rodar Lighthouse (DevTools → Lighthouse → categoria "Progressive Web App" / critério "Installable" nas versões que ainda o separam) e confirmar que o critério de instalabilidade passa.

- [ ] **Step 4: Confirmar não-regressão nas páginas existentes**

Navegar manualmente para `/`, `/produtos/[id]` (qualquer produto existente), `/categoria/[slug]` (qualquer categoria existente) e `/cotacao`. Confirmar que todas carregam normalmente, sem diferença de comportamento perceptível em relação a antes desta mudança.

- [ ] **Step 5: Checagem em Android (opcional, se houver device/emulador disponível)**

Abrir o site publicado (ou via túnel local) no Chrome Android, confirmar que o banner customizado de instalação aparece, tocar "Instalar" e confirmar que o app abre em tela cheia (sem barra de endereço) a partir do ícone criado na tela inicial.

Nenhum commit nesta task (é só verificação, sem mudança de código). Se algo falhar, voltar à task correspondente (1–6), corrigir, e repetir a verificação.
