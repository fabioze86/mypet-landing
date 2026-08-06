# Push Notifications — broadcast via PWA (reutilizável)

## Contexto e motivação

O app `apps/distribuidora` já é um PWA instalável (ver [2026-07-31-pwa-distribuidora-design.md](2026-07-31-pwa-distribuidora-design.md)), mas aquela entrega deixou push notifications explicitamente fora de escopo. Agora a distribuidora quer poder mandar avisos de promoção/novidade de catálogo direto pra tela do celular de quem instalou o app — sem depender de WhatsApp ou de o cliente abrir o site sozinho.

O monorepo já tem um padrão consolidado pra funcionalidade compartilhada entre sites (`leads`/`leads-server` em `@mypet/core`, com uma tabela única no Supabase hub diferenciada por `channel`). Esta entrega segue o mesmo padrão, para que `mypet` e `azpetshop` possam ligar a mesma funcionalidade depois sem duplicar código — mas a integração de UI (banner de opt-in, service worker) nesta entrega é feita **apenas** em `apps/distribuidora`.

## Objetivo

Permitir que quem instalou o PWA da distribuidora receba notificações push de campanha (broadcast), e permitir disparar esse broadcast por um script de linha de comando, sem exigir login/conta de usuário.

## Escopo

**Dentro do escopo:**
- Tabela `push_subscriptions` no Supabase hub (mesmo projeto de `leads`), com coluna `channel`.
- Lógica reutilizável em `@mypet/core`: helper client-side de subscribe, handler de API de subscribe, e função de envio de broadcast (server-side, usando `web-push`).
- Integração em `apps/distribuidora`: rota de API de subscribe, atualização do `public/sw.js` para tratar eventos `push`/`notificationclick`, e opt-in de permissão amarrado ao fluxo de instalação já existente (`install-prompt.tsx`).
- Script de linha de comando na raiz do monorepo para disparar um broadcast por canal.
- Testes unitários para a lógica de subscribe e de envio (seguindo o padrão de `leads-server.test.ts`), com Supabase e `web-push` mockados.

**Fora do escopo (não faz parte desta entrega):**
- Notificação transacional/direcionada a uma pessoa específica (ex: status de pedido). A tabela e a função de envio são desenhadas de forma que isso seja viável depois, mas não é implementado agora.
- Login/identidade de usuário — a subscription é anônima, vinculada só ao `endpoint` do navegador.
- UI de administração para disparar campanhas (ex: tela no app `admin`) — o disparo é só via script de terminal.
- Integração em `mypet` e `azpetshop` — só a base fica reutilizável; a integração de UI/service worker em cada site é trabalho futuro separado.
- Segmentação de público (ex: só quem visitou categoria X) — todo broadcast vai para todas as subscriptions do canal.
- Métricas de entrega/abertura.

## Arquitetura

```
packages/core/
├── src/
│   ├── push.ts                    (novo — client)
│   ├── push-server.ts             (novo — server: subscribe handler + sendPushBroadcast)
│   └── push-server.test.ts        (novo)
└── package.json                   (editado — adiciona dependência "web-push")

apps/distribuidora/
├── app/
│   ├── api/push/subscribe/route.ts    (novo)
│   └── components/install-prompt.tsx  (editado)
└── public/sw.js                       (editado)

scripts/
└── push-send.ts                   (novo, raiz do monorepo)

package.json                       (editado — script "push:send", devDependencies "tsx"/"dotenv",
                                     dependency "@mypet/core": "workspace:*" para o script importar)
```

Fluxo de opt-in: usuário toca "Instalar" no banner existente → `beforeinstallprompt.prompt()` resolve com `outcome === "accepted"` → `install-prompt.tsx` chama `subscribeToPush("distribuidora", vapidPublicKey)` → `Notification.requestPermission()` → se concedida, `pushManager.subscribe()` → `POST /api/push/subscribe` → grava em `push_subscriptions`. Para iOS (que não dispara `beforeinstallprompt`), o mesmo `subscribeToPush` é tentado no `mount` do componente quando o app já está rodando em modo standalone e a permissão ainda não foi decidida — cobre o cliente que já adicionou manualmente à tela de início.

Fluxo de envio: operador roda `pnpm push:send distribuidora "Título" "Mensagem" [url]` → script lê todas as linhas de `push_subscriptions` do canal → chama `web-push.sendNotification` para cada uma → subscriptions que retornam 404/410 (expiradas) são removidas do banco.

Fluxo de recepção: navegador recebe push em segundo plano → `sw.js` escuta `push`, monta a notificação com `title`/`body`/`icon` do payload → usuário toca a notificação → `notificationclick` fecha a notificação e abre a `url` do payload (ou `/`).

## Componentes

### Tabela `push_subscriptions` (Supabase hub)
```sql
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  channel text not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index push_subscriptions_channel_idx on push_subscriptions (channel);
```
Migração aplicada manualmente no Supabase hub (mesmo processo já usado para `leads`; não há pasta de migrations versionada no repo hoje).

### `packages/core/src/push.ts` (client)
```ts
export async function subscribeToPush(channel: Channel, vapidPublicKey: string): Promise<void>
```
- Verifica `"serviceWorker" in navigator && "PushManager" in window`; se não suportado, retorna sem erro.
- Pede permissão (`Notification.requestPermission()`); se negada ou já `"denied"`, retorna sem erro.
- Pega o SW já registrado (`navigator.serviceWorker.ready`), chama `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`.
- `POST` a subscription serializada (`JSON.stringify(subscription)`) para `/api/push/subscribe`.
- Qualquer falha (permissão, subscribe, rede) é silenciosa — nunca lança exceção pro chamador, mesmo tratamento de erro do resto do fluxo de PWA.

### `packages/core/src/push-server.ts` (server)
```ts
export function createPushSubscribePostHandler(channel: Channel): (req: NextRequest) => Promise<Response>
export async function sendPushBroadcast(channel: Channel, payload: { title: string; body: string; url?: string }): Promise<{ sent: number; removed: number }>
```
- `createPushSubscribePostHandler`: valida `endpoint`, `keys.p256dh`, `keys.auth` no corpo; faz `upsert` na tabela `push_subscriptions` por `endpoint` (evita duplicata se o mesmo dispositivo assinar de novo). Retorna 400 se faltar campo, 500 genérico em erro do Supabase (mesmo padrão de `leads-server.ts`).
- `sendPushBroadcast`: busca todas as linhas do `channel`, chama `web-push.sendNotification(subscription, JSON.stringify(payload), { vapidDetails })` para cada uma. Em erro com `statusCode` 404 ou 410, apaga a linha do banco (subscription morta). Outros erros só são logados, não interrompem o loop. Retorna contagem de enviados/removidos pro script de CLI reportar.

### `apps/distribuidora/app/api/push/subscribe/route.ts`
```ts
export const POST = createPushSubscribePostHandler("distribuidora");
```

### `apps/distribuidora/public/sw.js`
Mantém o comportamento atual (sem cache, `fetch` vazio) e ganha:
```js
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || "Distribuidora Petshop", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
```

### `apps/distribuidora/app/components/install-prompt.tsx`
- `handleInstall`: após `outcome === "accepted"`, chama `subscribeToPush("distribuidora", process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!)` (fire-and-forget, não bloqueia o fechamento do banner).
- Novo `useEffect` (roda uma vez no mount): se `isStandalone()` e `Notification.permission === "default"`, chama `subscribeToPush` do mesmo jeito — cobre iOS e quem já tinha instalado antes desta entrega.

### `scripts/push-send.ts` (raiz do monorepo)
Script Node standalone, executado via `tsx` (novo devDependency na raiz — não há precedente de script Node no repo hoje, os scripts de geração citados no commit `1d9ca97` são Python e não relacionados). Uso:
```
pnpm push:send <channel> "<título>" "<mensagem>" [url]
```
- Valida `channel` contra `isChannel()` de `@mypet/core/channels`.
- Chama `sendPushBroadcast` e imprime `Enviado: N, removidas (expiradas): M`.
- Lê `PUSH_VAPID_PUBLIC_KEY`, `PUSH_VAPID_PRIVATE_KEY`, `PUSH_VAPID_SUBJECT`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` do ambiente (`.env` na raiz, via `dotenv`, novo devDependency).

### Variáveis de ambiente (novas)
- `PUSH_VAPID_PUBLIC_KEY` / `PUSH_VAPID_PRIVATE_KEY` — par único gerado uma vez (`npx web-push generate-vapid-keys`) para todo o hub.
- `PUSH_VAPID_SUBJECT` — `mailto:` de contato exigido pelo protocolo VAPID.
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — mesma chave pública, exposta ao browser no app `distribuidora`.

## Tratamento de erro

- Todo o lado client (`push.ts`, chamadas em `install-prompt.tsx`) é silencioso: ausência de suporte, permissão negada, ou falha de rede nunca bloqueiam a navegação nem reaparecem como erro visível — mesmo princípio já aplicado ao resto do fluxo de PWA.
- O handler de subscribe responde 400 em corpo inválido e 500 genérico em falha do Supabase, mesmo padrão de `leads-server.ts`.
- `sendPushBroadcast` isola falha por subscription: uma subscription expirada ou com erro não interrompe o envio pras demais; subscriptions mortas (404/410) são limpas automaticamente do banco.

## Testes / verificação

- `push-server.test.ts` (Vitest, Supabase mockado): valida upsert do subscribe, 400 em campo faltando, 500 em erro do Supabase, e o comportamento de `sendPushBroadcast` (conta enviados, remove subscription em 404/410, não remove em outros erros) com `web-push` mockado.
- Verificação manual: build de produção do `distribuidora`, instalar o PWA num Android real ou emulado, aceitar a permissão de notificação, rodar `pnpm push:send distribuidora "Teste" "Mensagem de teste"` e confirmar que a notificação chega mesmo com o app fechado.
- Sem verificação automatizada de iOS (exige dispositivo físico com iOS 16.4+); validar manualmente se houver aparelho disponível.
