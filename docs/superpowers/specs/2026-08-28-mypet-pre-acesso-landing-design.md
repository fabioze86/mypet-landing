# Landing de pré-acesso B2B da My Pet

**Data:** 2026-08-28
**Status:** Aprovado para planejamento
**Escopo:** `apps/mypet` e `packages/core`
**Substitui:** a versão anterior desta spec, que usava confirmação por magic link como fronteira de aprovação.

## Objetivo

Transformar a rota pública da My Pet numa landing de pré-acesso que educa e qualifica lojistas antes de eles entrarem no e-commerce B2B. A página responde às dúvidas comerciais que hoje chegam pelo WhatsApp — pedido mínimo, desconto por volume, frete, pagamento e prazo — e leva o lead apto a criar acesso à loja.

O cadastro é o mais curto possível e a liberação é imediata: não há e-mail de confirmação, não há link, não há senha. O objetivo é reduzir conversas repetitivas no WhatsApp sem criar atrito para quem já tem intenção de compra.

## Decisões aprovadas

- O mesmo domínio hospeda os dois destinos.
- `/` é a landing pública de educação e qualificação.
- O e-commerce atual sai de `/` e passa para `/loja`, agora protegido.
- O cadastro é composto por **CNPJ e WhatsApp obrigatórios** e **e-mail opcional**. O e-mail não é verificado; serve apenas como contato.
- A aprovação é automática e imediata. Após um envio válido o visitante recebe uma sessão de acesso (cookie assinado) e segue direto para `/loja`.
- Não há tela de login separada. O mesmo formulário serve para o primeiro acesso e para o retorno; o servidor decide o que fazer a partir do CNPJ.
- As condições comerciais começam como exemplos centralizados numa configuração tipada e são substituíveis sem alterar a interface.
- Preços e a experiência de compra só existem depois de uma sessão válida. Preços não podem compor o HTML nem o bundle público de `/`.
- A ponte com o Hub Clientes fica fora de escopo; apenas a coluna `source` em `buyers` é preparada para ela.

## Jornada do visitante

```text
Anúncio / busca / indicação
  -> / (landing pública, sem preços)
  -> entende as condições comerciais, categorias, FAQ e conteúdo institucional
  -> "Criar acesso à loja"
  -> cadastro: CNPJ + WhatsApp (+ e-mail opcional)
  -> POST /api/pre-acesso: normaliza, valida, aplica limite de reenvio,
     grava/atualiza o comprador e emite o cookie de sessão
  -> /loja (e-commerce com preços visíveis)
```

Retorno num navegador sem cookie válido (trocou de aparelho, limpou dados, cookie expirado): o visitante preenche o mesmo formulário. Se o CNPJ já existe e o WhatsApp confere com o cadastro, ele entra na hora; se não confere, recebe o erro genérico de dados inválidos.

## Comportamento do endpoint de acesso

`POST /api/pre-acesso` recebe `{ cnpj, whatsapp, email? }` com os valores como digitados e executa, em ordem:

1. **Normalização.** `cnpj` e `whatsapp` reduzidos a dígitos; `email` com `trim` + `toLowerCase`, ou ausente.
2. **Validação.** CNPJ com 14 dígitos e dígitos verificadores válidos; WhatsApp com 12 ou 13 dígitos começando por `55`; e-mail, quando presente, com um `@` e domínio não vazio; limites de tamanho em todos os campos. Falha → `INVALID_INPUT`.
3. **Limite de reenvio.** Conta os registros de `pre_access_attempts` do mesmo CNPJ nos últimos 5 minutos; acima de 5 → `RATE_LIMITED`. Registra a tentativa (CNPJ normalizado + hash de IP + timestamp).
4. **Provisionamento por CNPJ.**
   - CNPJ inexistente → insere um comprador novo (`id` gerado pela aplicação, `source = 'landing'`, `nome`/`empresa` nulos).
   - CNPJ existente e WhatsApp confere com o cadastro → atualiza `whatsapp`/`email` quando informados e segue.
   - CNPJ existente e WhatsApp não confere → `INVALID_INPUT`.
5. **Erro de banco ou infraestrutura** → `UNAVAILABLE`.

Em sucesso, a resposta é `{ ok: true }` com status `201` e um cabeçalho `Set-Cookie` com o token de sessão assinado. O corpo nunca devolve o registro do banco nem dados pessoais normalizados.

Mapeamento de erros e mensagens visíveis (fixas):

| Código | HTTP | Mensagem |
| --- | --- | --- |
| `INVALID_INPUT` | 400 | `Confira os dados informados e tente novamente.` |
| `RATE_LIMITED` | 429 | `Aguarde alguns instantes antes de tentar novamente.` |
| `UNAVAILABLE` | 503 | `Não foi possível liberar seu acesso agora. Tente novamente em instantes.` |

## Sessão de acesso

- Cookie `mypet_acesso`, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, `Max-Age` de 30 dias.
- Conteúdo: `base64url(payload) + "." + base64url(HMAC-SHA256(payload, ACCESS_SESSION_SECRET))`, com `payload = { b: <buyerId>, exp: <epoch ms> }`.
- `verifyAccessToken` recusa (retorna `null`) assinatura inválida, formato inválido ou `exp` no passado.
- `ACCESS_SESSION_SECRET` é uma variável de ambiente nova, documentada em `.env.example` / `.env.local`.
- Não há revogação central nem registro de sessões; é aceitável nesta etapa.

`requireBuyerAccess()` lê o cookie via `next/headers`, valida o token e carrega o comprador pelo `id` usando o cliente service-role. Retorna o comprador ou `null`.

## Componentes e responsabilidades

### `packages/core`

| Arquivo | Responsabilidade |
| --- | --- |
| `src/pre-access-server.ts` | Server-only. `normalizePreAccessInput`, `validatePreAccessInput`, `provisionBuyer(input, ctx)`, `requireBuyerAccess()`. Usa `getHubServiceClient()` de `@mypet/core/supabase`. Nunca registra CNPJ, WhatsApp ou e-mail crus em log. |
| `src/access-session.ts` | Server-only. `signAccessToken(buyerId, now?)`, `verifyAccessToken(token?)`, `ACCESS_COOKIE`, `ACCESS_COOKIE_OPTS`. Sem dependência de Next além de tipos. |
| `src/pre-access-server.test.ts`, `src/access-session.test.ts` | Cobertura unitária das fronteiras acima. |
| `src/buyers-server.ts` | `Buyer` passa a ter `nome`, `empresa` e `email` como `string | null`. `createBuyer` deixa de exigir `nome`/`empresa`. |
| `src/auth-server.ts` | `createAuthCallbackHandler` e o fluxo de troca de código deixam de ser usados pelo app mypet; podem ser removidos se nenhum outro app depender deles (confirmar na implementação). |
| `package.json` (exports) | Adicionar `./pre-access-server` e `./access-session`. |

### `apps/mypet`

| Caminho | Responsabilidade |
| --- | --- |
| `app/page.tsx` | Composição da landing pública e metadata. Não importa `getCatalog`, `catalog-section`, `product-card` nem `lead-gate`. |
| `app/pre-access-content.ts` | Configuração tipada única: condições comerciais, cards de educação, FAQ, textos institucionais. Valores são exemplos de desenvolvimento, comentados como tal. |
| `app/_components/pre-access/hero.tsx` | Contexto (atacado para pet shops), mensagem principal, CTA `Ver condições` (rola para `#condicoes`) e CTA secundário `Já tenho acesso` (rola para `#acesso`). |
| `app/_components/pre-access/commercial-conditions.tsx` | Três blocos: pedido mínimo, desconto por volume, entrega/frete/prazo. |
| `app/_components/pre-access/education-cards.tsx` | Faixa horizontal navegável por teclado; cada card leva a uma seção da própria página. |
| `app/_components/pre-access/popular-categories.tsx` | Categorias reais de `getCategories()`, sem preço e sem card de produto. |
| `app/_components/pre-access/commercial-faq.tsx` | Accordion com as oito perguntas da seção "FAQ comercial" abaixo; ARIA e teclado corretos. |
| `app/_components/pre-access/institutional-trust.tsx` | Indicadores institucionais comprováveis. Sem depoimentos, números ou selos fictícios. |
| `app/_components/pre-access/access-form.tsx` | Único client component. Campos na ordem CNPJ, WhatsApp, e-mail (opcional), com `autoComplete` `organization` / `tel` / `email`, frase de consentimento e link para a política de privacidade. Faz `POST` de `{ cnpj, whatsapp, email }` para `/api/pre-acesso`. Estados: erro genérico e sucesso (redireciona para `/loja`). |
| `app/_components/pre-access/access-form.test.tsx` | Testa que o formulário envia exatamente os três campos e trata erro e sucesso. |
| `app/api/pre-acesso/route.ts` | `POST` público. Chama `provisionBuyer`, monta o `Set-Cookie` com `signAccessToken`, aplica o mapa de erros acima. |
| `app/api/pre-acesso/route.test.ts` | Cobre 201 + cookie, 400, 429, 503 e ausência de dados pessoais no corpo. |
| `app/loja/page.tsx` | Recebe a composição de catálogo hoje em `app/page.tsx`. No topo do server component: `const buyer = await requireBuyerAccess(); if (!buyer) redirect("/");`. Remove `LeadGateProvider` / `UnlockButton` / modal; dentro da loja o preço aparece direto. Links internos para `/` passam a apontar para `/loja`. |
| `app/loja/page.test.tsx` | Sem cookie → `redirect("/")`; com cookie válido → renderiza o catálogo. |
| `proxy.ts` | Matcher ganha `/loja/:path*`; sem cookie válido, redireciona para `/`. Apenas roteamento otimista — a autoridade é o server component. Entradas obsoletas (`/entrar`, `/completar-cadastro`) removidas ou ajustadas. |
| `proxy.test.ts` | `/loja` anônimo → `redirect("/")`. |
| `app/entrar/page.tsx`, `app/entrar/callback/route.ts` | `/entrar` vira `redirect("/#acesso")`; a rota de callback sai do fluxo. |
| `app/completar-cadastro/page.tsx` | `redirect("/#acesso")`; não coleta mais nome nem empresa. |
| `app/cotacao/page.tsx`, `app/pedidos/page.tsx` | Trocam a checagem de sessão Supabase Auth por `requireBuyerAccess()`: sem comprador, `redirect("/")`. Nenhuma outra mudança de conteúdo nesta entrega. |
| `app/layout.tsx` | Metadata raiz para atacado B2B My Pet, sem métricas inventadas. |
| `app/sitemap.ts` | Inclui `/`. Nunca inclui `/loja`, `/entrar`, `/completar-cadastro`, `/cotacao`, `/pedidos` ou `/api/*`. |
| `app/robots.ts` | Bloqueia `/loja`, `/entrar`, `/completar-cadastro`, `/cotacao`, `/pedidos` e `/api/`. |
| `app/page.test.tsx` | A landing pública não contém `priceLabel` nem o texto `Preço do canal distribuidora`. |
| `vitest.config.ts` + `package.json` | Infraestrutura de testes do app (ver abaixo). |

## Banco de dados

Projeto Supabase: **`hub_catalogo`** (ref `hsguyfiyqpuligijcjlw`). A tabela `public.buyers` já existe e está vazia (zero linhas), o que elimina risco de migração de dados.

Estado atual de `buyers`: `id uuid` PK com FK `buyers_id_fkey` para `auth.users(id) ON DELETE CASCADE`; `email text NOT NULL` com `UNIQUE (buyers_email_key)`; `nome text NOT NULL`; `empresa text NOT NULL`; `whatsapp text NOT NULL`; `cnpj text NULL`; `created_at timestamptz NOT NULL default now()`. RLS habilitada com políticas baseadas em `auth.uid()`.

Migração nova em `supabase/migrations/` (pasta criada nesta entrega) e também aplicada ao projeto via ferramenta do Supabase:

```sql
-- Identidade passa a ser o CNPJ; id deixa de depender de auth.users
alter table public.buyers drop constraint if exists buyers_id_fkey;
alter table public.buyers alter column id set default gen_random_uuid();

-- Campos que o formulário aprovado não coleta
alter table public.buyers alter column nome drop not null;
alter table public.buyers alter column empresa drop not null;
alter table public.buyers alter column email drop not null;
alter table public.buyers drop constraint if exists buyers_email_key;

-- CNPJ como identificador de retorno
alter table public.buyers add constraint buyers_cnpj_key unique (cnpj);

-- Origem do cadastro (preparação para a ponte futura com o Hub Clientes)
alter table public.buyers add column if not exists source text not null default 'landing';

-- Limite de reenvio (antiabuso) sem PII crua além do CNPJ normalizado
create table public.pre_access_attempts (
  id bigint generated always as identity primary key,
  cnpj text not null,
  ip_hash text,
  created_at timestamptz not null default now()
);
create index pre_access_attempts_lookup
  on public.pre_access_attempts (cnpj, created_at desc);
```

RLS permanece habilitada em `buyers` (nega acesso anônimo por padrão, protegendo os dados dos lojistas). As políticas atuais baseadas em `auth.uid()` ficam sem efeito, já que não há mais sessão Supabase Auth; todo acesso da aplicação passa pelo cliente service-role confinado a `pre-access-server.ts`. `pre_access_attempts` também fica só com acesso service-role.

O e-mail é gravado como `NULL` quando não informado, nunca como string vazia.

## Variáveis de ambiente

- `ACCESS_SESSION_SECRET` — **nova**. Segredo do HMAC do cookie de sessão. Sem valor não é possível emitir nem validar acesso.
- `SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_URL` — já referenciadas por `getHubServiceClient()` em `packages/core/src/supabase.ts`, mas ausentes em `apps/mypet/.env.local`. Precisam ser adicionadas.

Documentar as três em `.env.example` (ou equivalente) e em `apps/mypet/.env.local`.

## Infraestrutura de testes do app

`apps/mypet` não tem Vitest hoje (sem `vitest.config`, sem script `test`, sem Testing Library). A primeira task que tocar o app adiciona, espelhando `packages/core`:

- devDependencies: `vitest` (mesma major de `packages/core`, `^4`), `@vitejs/plugin-react`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom`;
- `apps/mypet/vitest.config.ts` com `environment: "jsdom"` e um setup file que registra `@testing-library/jest-dom`;
- script `"test": "vitest run"` em `apps/mypet/package.json`.

## FAQ comercial

O accordion cobre exatamente estas perguntas, todas com resposta vinda de `pre-access-content.ts`:

- Qual é o pedido mínimo?
- Há desconto para compras em maior quantidade?
- A My Pet vende para pessoa física?
- Quais são as formas de pagamento?
- Como é calculado o frete e quais regiões são atendidas?
- Qual é o prazo de entrega?
- Preciso de CNPJ para comprar?
- Como acesso os preços?

## Métricas de funil

Eventos sem dados pessoais (sem CNPJ, e-mail ou telefone como identificador):

- visualização da landing;
- clique em condições comerciais;
- abertura de uma resposta do FAQ;
- início do cadastro;
- cadastro concluído;
- chegada em `/loja`.

## SEO e acessibilidade

- Metadata específica para atacado B2B My Pet, mencionando "atacado para pet shops" e "condições de compra", sem inventar métricas.
- JSON-LD apenas com campos de organização verificáveis.
- Uma única hierarquia `h1` por página; títulos semânticos.
- Marcação estruturada de FAQ somente se refletir conteúdo visível e verdadeiro.
- Imagens com texto alternativo e dimensões definidas.
- Foco visível, navegação por teclado e accordions com ARIA.
- Boa leitura e CTAs em tela móvel antes da otimização para desktop.

## Critérios de aceite

- `/` mostra a landing e não expõe nenhum preço no HTML público nem em dados públicos carregados; as condições comerciais de exemplo aprovadas ficam visíveis; nenhuma expressão como "a definir" ou "placeholder" aparece na tela.
- `/loja` como anônimo redireciona para `/`; o catálogo só é buscado depois de `requireBuyerAccess()` retornar um comprador.
- Cadastro válido (CNPJ + WhatsApp, e-mail opcional) cria ou reconhece o comprador, emite o cookie e leva a `/loja`.
- CNPJ conhecido com WhatsApp divergente não libera o acesso e mostra o erro genérico.
- CNPJ, WhatsApp ou e-mail inválidos impedem o envio com a mensagem de correção.
- Reenvios rápidos do mesmo CNPJ recebem a mensagem de limite excedido.
- Falhas de API exibem feedback genérico e não criam estado de acesso indevido.
- FAQ, cards e CTA funcionam com teclado e em telas pequenas.
- As condições comerciais vêm de uma única configuração.
- `sitemap.ts` contém `/` e não contém `/loja`; `robots.ts` bloqueia as rotas protegidas e `/api/`.
- Erros internos, credenciais e dados pessoais não são expostos ao navegador nem gravados integralmente em log.
- Lint, testes relevantes e `build` do app passam.
- Revisão manual cobre a jornada completa em mobile e desktop: `/` sem preço, `/loja` anônimo bloqueado, cadastro válido, retorno com WhatsApp certo e errado, reenvio rápido.

## Fora de escopo nesta etapa

- Valores comerciais definitivos.
- Criação de depoimentos, números ou artigos fictícios.
- WhatsApp como CTA primário.
- Cálculo real de frete, desconto ou crédito.
- A ponte de importação a partir do Hub Clientes (apenas a coluna `source` é preparada).
- Tela administrativa de cadastro manual de lojista.
- Revogação de sessões e registro de dispositivos.
- Substituição de ERP, CRM ou fonte de catálogo.
- Regras comerciais que variam por perfil de cliente.
