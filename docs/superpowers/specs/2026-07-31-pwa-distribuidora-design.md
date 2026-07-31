# PWA — apps/distribuidora (instalável, sem cache)

## Contexto e motivação

O app `apps/distribuidora` (B2B, atacado, domínio `www.distribuidorapetshop.com.br`) já tem navegação mobile responsiva satisfatória. A venda pelo site vem caindo, e a hipótese a testar é que parte da queda vem de **fricção de retorno**: o cliente não tem um atalho rápido pra voltar a comprar e acaba preferindo canais como WhatsApp.

Um app nativo (Android/iOS) foi descartado por custo de manutenção desproporcional ao volume de clientes. Um PWA (Progressive Web App) resolve o problema específico de retenção — ícone na tela inicial, abertura em tela cheia sem barra de navegador — sem exigir loja de aplicativos, sem duplicar código, e reaproveitando 100% do site Next.js existente.

Este documento cobre **apenas** a primeira entrega: tornar `apps/distribuidora` instalável, com um convite de instalação visível. Cache offline de catálogo/imagens e suporte a iOS ficam fora de escopo — ver "Fora de escopo" abaixo.

## Objetivo

Permitir que o cliente da distribuidora instale o site como um atalho de tela cheia no Android/Chrome, com um convite ativo (banner customizado), sem introduzir cache de preço/estoque nem dependências novas no projeto.

## Escopo

**Dentro do escopo:**
- Manifest, ícones (placeholder) e service worker mínimo (sem cache) só em `apps/distribuidora`.
- Banner de instalação customizado (Android/Chrome), com lógica de "não incomodar de novo" por 7 dias após dispensa.
- Verificação manual (build de produção + Lighthouse) de que o app fica instalável.

**Fora do escopo (não faz parte desta entrega):**
- Cache de catálogo/imagens (`CacheFirst`) — decisão explícita de não usar Workbox/biblioteca de cache agora, por risco de servir preço/estoque desatualizado. Pode ser proposto como spec própria depois.
- Suporte a instalação/instrução manual no iOS/Safari (evento `beforeinstallprompt` não existe lá).
- Push notifications.
- Replicar para outros apps do monorepo (`mypet`, `azpetshop`, `hub`, `admin`) — decisão explícita de manter o código local a `apps/distribuidora` por ora, não em `packages/core`.
- Arte final dos ícones — usa-se um placeholder gerado (fundo navy + 🐾), a ser substituído quando houver logo definitivo.
- Testes automatizados do service worker.

## Arquitetura

Toda a mudança fica isolada em `apps/distribuidora/`, sem alterar `packages/core` ou outros apps:

```
apps/distribuidora/
├── public/
│   ├── manifest.json              (novo)
│   ├── sw.js                      (novo)
│   └── icons/
│       ├── icon-192.png           (novo, placeholder)
│       ├── icon-512.png           (novo, placeholder)
│       ├── icon-maskable-512.png  (novo, placeholder)
│       └── apple-touch-icon.png   (novo, placeholder, 180x180)
├── app/
│   ├── layout.tsx                 (editado)
│   └── components/
│       ├── register-sw.tsx        (novo)
│       └── install-prompt.tsx     (novo)
└── next.config.ts                 (sem mudança)
```

Fluxo: navegador lê `manifest.json` → registra `sw.js` (mínimo, sem cache) → critérios de instalabilidade do Chrome são satisfeitos → evento `beforeinstallprompt` dispara → `install-prompt.tsx` captura o evento e exibe banner customizado → usuário toca "Instalar" → diálogo nativo do Chrome confirma.

## Componentes

### `manifest.json`
Nome, ícones e cores derivados de `client.config.ts` (`clientConfig.name`, `palette.navy`). `display: "standalone"`, `start_url: "/"`.

### Ícones placeholder
Fundo sólido `#0F172A` (navy) com 🐾 branco centralizado, gerado via script simples (sem dependência de ferramenta de design). Tamanhos: 192, 512, 512-maskable, apple-touch (180, sem cantos arredondados — iOS recorta sozinho). Ficam marcados como provisórios até haver arte final.

### `public/sw.js`
Service worker mínimo — só o necessário para o critério de instalabilidade do Chrome (SW registrado + listener de `fetch`). Não intercepta nem cacheia nenhuma resposta; toda requisição segue direto pra rede, comportamento idêntico ao atual.

```js
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
```

### `register-sw.tsx`
Client component, registra `/sw.js` via `navigator.serviceWorker.register` dentro de `useEffect`, apenas quando `process.env.NODE_ENV === "production"` (evita interferência durante `next dev`). Falha de registro é silenciosa (`try/catch`) — o site continua funcionando normalmente como página comum.

### `install-prompt.tsx`
Client component que:
- Escuta `beforeinstallprompt`, guarda o evento e mostra um banner fixo (paleta navy/slate do app) com CTA "Instalar" e botão de fechar.
- "Instalar" → chama `prompt()` no evento salvo → diálogo nativo do Chrome.
- Fechar → grava timestamp em `localStorage`; banner não reaparece por 7 dias.
- Se o app já roda em modo standalone (`display-mode: standalone` via media query) ou o navegador não dispara o evento (iOS, Firefox), o banner nunca aparece — sem fallback visual.

### `layout.tsx`
Ganha `<link rel="manifest" href="/manifest.json">`, `<meta name="theme-color" content="#0F172A">`, e os componentes `<RegisterSW />` e `<InstallPrompt />` renderizados dentro do body.

## Tratamento de erro

Toda falha relacionada a PWA (registro de SW, ausência do evento de instalação) é silenciosa e não bloqueia a navegação normal do site — o app sempre funciona como site comum, com ou sem os recursos de PWA disponíveis.

## Testes / verificação

- `npm run build && npm run start` em `apps/distribuidora`, verificar via Chrome DevTools (Application > Manifest / Service Workers) que manifest e SW carregam sem erro.
- Rodar Lighthouse e confirmar critério "Installable" atendido.
- Conferir manualmente que páginas existentes (`/`, `/produtos/[id]`, `/categoria/[slug]`, `/cotacao`) continuam carregando normalmente, sem diferença de comportamento perceptível.
- Sem testes automatizados nesta entrega (SW não tem lógica de cache a testar).
