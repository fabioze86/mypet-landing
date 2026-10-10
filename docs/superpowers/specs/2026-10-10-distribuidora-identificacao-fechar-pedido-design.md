# Distribuidora — identificação no primeiro acesso e "Fechar pedido" direto no WhatsApp

**Data:** 2026-10-10
**App:** `apps/distribuidora` (canal de catálogo `mypetbrasil`; pedidos com canal `distribuidora`)
**Base:** spec de 2026-10-07 (`2026-10-07-distribuidora-whatsapp-checkout-design.md`), já implementada e publicada.

## Problema

Hoje o botão flutuante leva ao `/cotacao`, onde o cliente ainda precisa digitar os dados antes de ir ao WhatsApp. A referência (Pague Menos / Suri) leva direto ao WhatsApp. A identificação passa a acontecer **uma vez, na entrada do site**. Depois disso, fechar o pedido é um toque.

## Escopo

1. Pop-up de identificação obrigatório no primeiro acesso: **Nome** e **WhatsApp** obrigatórios, **CNPJ** opcional.
2. Barra flutuante "Fechar pedido": grava o pedido e abre o WhatsApp direto.
3. `/cotacao` vira página de revisão: sem formulário, mostra os dados identificados e o link "Alterar dados".
4. A mensagem do WhatsApp e o pedido usam os dados do pop-up. A empresa sai do fluxo.
5. O lead é gravado em `leads` no momento da identificação.

**Fora do escopo:**
- e-mail;
- consulta de razão social pelo CNPJ;
- verificação do WhatsApp;
- login;
- bloqueio no servidor (o conteúdo continua renderizado para SEO);
- integração com `buyers` / pré-acesso do mypet.

## Decisões

- **Bloqueio só no cliente.** As páginas continuam renderizadas no servidor (SEO e Google inalterados). Um pop-up sem botão de fechar cobre o site até a identificação.
- **Os dados ficam em `localStorage`** (`mypet_identity`), e o lead vai para `leads`. Ele **não** grava em `buyers`: essa tabela é compartilhada com o mypet e é a base do login dele por CNPJ.
- **Erro nosso não prende o cliente.** Se a gravação do lead falhar, o site é liberado assim mesmo e o erro vai para o log.
- **O mypet não muda.** O `/cadastro` do mypet usa `buyers` e `pre_access_attempts`, não `leads`. O pop-up "Fale com" (`LeadGateProvider` + `createLeadsPostHandler`) continua exigindo nome, empresa e WhatsApp.

## Banco

Migration `supabase/migrations/20261010120000_leads_empresa_opcional.sql`:
```sql
alter table public.leads alter column empresa drop not null;
```
A tabela está vazia hoje. Os leitores (admin `/clientes` e o export) passam a mostrar "—" quando `empresa` for nula.

## Componentes

### Validação brasileira — `packages/core/src/br-validation.ts` (novo, puro)
- `onlyDigits(value)`.
- `isValidCnpj(digits)`. Extraída de `pre-access-server.ts`, que passa a importá-la, sem mudança de comportamento.
- `normalizeWhatsapp(value) → string | null`. Remove tudo que não for dígito e o `55` inicial, se houver. Exige DDD + número, de 10 ou 11 dígitos. Retorna `55` + dígitos, ou `null`. É o mesmo formato que o pré-acesso grava (`^55\d{10,11}$`).
- `formatCnpj(digits)` e `formatWhatsapp(digits)`: máscaras de exibição e digitação.

### Lead da distribuidora — `createIdentityLeadHandler(channel)` em `packages/core/src/leads-server.ts`
- **Entrada:** `{ nome, whatsapp, cnpj? }`.
- **Validação (400 `{ error, field? }`):**
  - **`nome`:** obrigatório, de 2 a 120 caracteres depois do trim.
  - **`whatsapp`:** obrigatório, válido por `normalizeWhatsapp`.
  - **`cnpj`:** se vier preenchido, precisa passar em `isValidCnpj`.
- **Mesmas defesas da rota de pedido:** 415 sem `Content-Type: application/json`, 403 com `Origin` de outro host.
- **Grava em `leads`:** `{ nome, empresa: null, whatsapp: normalizado, cnpj: dígitos ou null, channel }`. Responde 200 `{ ok: true }`, ou 500 `{ error }`.
- A rota `apps/distribuidora/app/api/leads/route.ts` passa a exportar esse handler.

### Identidade no cliente — `apps/distribuidora/app/identity/`
- **`identity-store.ts`:** guarda `{ nome, whatsapp, cnpj }` no `localStorage`, na chave `mypet_identity`.
  - `readIdentity()`, `saveIdentity()` e o hook `useIdentity()` (via `useSyncExternalStore`, com snapshot de servidor `null`).
  - Leitura e escrita ficam em try/catch. Sem `localStorage`, o pop-up aparece a cada visita, e isso é aceito.
- **`identity-gate.tsx`** (client): o pop-up.
  - Aparece quando `useIdentity()` é `null` depois da hidratação, ou quando reaberto por "Alterar dados" (`IdentityGateProvider` expõe `openIdentityGate()`).
  - Na primeira identificação não tem fechar, `Esc` nem clique fora. Ao reabrir por "Alterar dados", pode ser fechado.
  - **Campos:** "Seu nome", "WhatsApp com DDD" (máscara) e "CNPJ (opcional)" (máscara). Título "Acesse o catálogo", botão "Acessar catálogo".
  - **Validação no cliente:** a mesma do servidor (`br-validation`), com erro por campo.
  - **Ao enviar:**
    - `POST /api/leads`;
    - se a resposta for 400, mostra o erro do campo;
    - em sucesso, falha de rede ou 5xx, salva a identidade e fecha (`console.error` na falha);
    - acessibilidade: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` no título, foco no primeiro campo ao abrir e `overflow: hidden` no `body` enquanto aberto.
  - A identidade salva tem `whatsapp` já normalizado (`55` + dígitos) e `cnpj` só com dígitos (ou `null`). A exibição usa `formatWhatsapp`/`formatCnpj`.
- Montado no `layout.tsx`, dentro do `CartProvider`.

### Checkout direto — `apps/distribuidora/app/checkout/use-checkout.ts`
Hook `useCheckout()` → `{ checkout(): Promise<void>, sending: boolean }`. O fluxo é o mesmo que hoje está no `handleSubmit` de `cotacao-content.tsx`, que passa a usar o hook:
1. Lê a identidade. Sem identidade, abre o pop-up e não segue.
2. Usa um ref contra duplo toque.
3. Chama `registerOrder(cart.items, { nome, whatsapp, cnpj })`. Para a mensagem, o cliente vai como `{ nome, whatsapp: formatWhatsapp(whatsapp), cnpj: cnpj ? formatCnpj(cnpj) : undefined }`.
4. Se a resposta for `invalid`, retorna o erro para quem chamou exibir.
5. Monta a mensagem (`buildQuoteMessage` com `showPrices` e `orderNumber`, quando houver), abre `wa.me` em `_self` e limpa o carrinho.

### Barra flutuante — `CartBar` (core)
Novas props opcionais, com o comportamento atual como padrão:
- `actionLabel?: string`: padrão `"Enviar pedido"`.
- `onAction?: () => void`: quando presente, o lado direito vira `<button>` e chama `onAction`, em vez de ser link.
- `busy?: boolean`: mostra "Enviando…" e desabilita o botão.
- `secondaryHref?: string` e `secondaryLabel?: string`: link pequeno ("ver itens").

O comportamento de ocultar na própria `href` (`/cotacao`) é mantido.

Na distribuidora, um wrapper client (`checkout/checkout-bar.tsx`) liga a barra assim: `actionLabel="Fechar pedido"`, `onAction={checkout}`, `busy={sending}`, `secondaryHref="/cotacao"`, `secondaryLabel="ver itens"`. Erro `invalid` aparece num aviso curto acima da barra.

### Mensagem e pedido
- `QuoteCustomer` (`packages/core/src/whatsapp.ts`) passa a ter `empresa?: string`. A linha "Empresa:" só sai quando houver valor. Os outros apps continuam passando a empresa, e a saída deles não muda.
- `createOrdersPostHandler` (`guest-orders-server.ts`):
  - `empresa` passa a ser opcional;
  - exige `nome` e `whatsapp` (normalizado por `normalizeWhatsapp`);
  - valida o CNPJ quando vier;
  - grava `customer_company: null` quando não houver empresa;
  - mensagem de erro: "Preencha nome e WhatsApp.".

### `/cotacao`
- Itens, quantidades e totais como hoje.
- O formulário sai. No lugar entra o bloco "Seus dados" (nome, WhatsApp formatado e CNPJ, se houver), com o link "Alterar dados" chamando `openIdentityGate()`.
- Botão "Fechar pedido pelo WhatsApp →" usando `useCheckout()`, com o erro `invalid` exibido acima do botão.

### Admin
- `/clientes` e o export: empresa nula aparece como "—".
- `/pedidos`: já mostra "—" sem empresa. Basta confirmar.

## Testes

- **`br-validation.test.ts`:** CNPJ válido, inválido e com dígitos repetidos; WhatsApp com e sem 55, com máscara, curto e longo.
- **`pre-access-server`:** os testes existentes continuam passando depois da extração.
- **`leads-server.test.ts`:** o handler novo cobre obrigatórios, CNPJ opcional e inválido, normalização do WhatsApp, `empresa: null`, 415/403 e 500. O handler antigo não muda.
- **`guest-orders-server.test.ts`:** passa sem empresa; continua exigindo nome e WhatsApp; recusa CNPJ inválido.
- **`whatsapp.test.ts`:** sem empresa omite a linha; com empresa mantém a saída atual.
- **`identity-gate.test.tsx`:**
  - aparece sem identidade e não aparece com ela;
  - não tem botão de fechar na primeira vez;
  - valida os campos;
  - grava o lead e salva a identidade;
  - libera quando a API falha;
  - mostra o erro do campo em 400;
  - reabre via "Alterar dados" com botão de fechar.
- **`use-checkout`, `checkout-bar` e `cotacao-content`:**
  - a barra fecha o pedido e abre o WhatsApp com os dados da identidade;
  - sem identidade, abre o pop-up;
  - duplo toque gera um só pedido;
  - `/cotacao` não tem formulário e mostra "Alterar dados".
- **`cart-bar.test.tsx`:** o padrão continua link "Enviar pedido →"; com `onAction`, vira botão; `busy`; link secundário.

## Riscos

- **Pop-up com bloqueio só no cliente** é contornável (limpar o storage ou desativar JS). É aceito: os preços já são públicos e o objetivo é captar o contato, não proteger conteúdo.
- **Spam no `POST /api/leads`:** mitigado por validação, Content-Type/Origin e o rate limit no firewall da Vercel, que ainda está pendente.
- **Pré-renderização com `cacheComponents`:** o pop-up depende só do `localStorage` (client), então não lê dado dinâmico no servidor. Se precisar de `usePathname`, fica dentro do mesmo `Suspense` da `CartBar`.
