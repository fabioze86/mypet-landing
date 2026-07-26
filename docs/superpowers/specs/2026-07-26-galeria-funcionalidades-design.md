# Galeria de funcionalidades por site

**Data:** 2026-07-26
**Status:** Aprovado — pronto para plano de implementação

## Contexto e problema

Hoje `apps/mypet` e `apps/distribuidora` usam o mesmo fluxo de "cotação" (preço
fechado + `LeadGateProvider` + WhatsApp); `apps/azpetshop` não usa esse gate. Cada
app decide seu comportamento hardcoded no próprio código — não existe um lugar único
que diga "este site usa cotação, aquele usa outra coisa".

O usuário quer trocar o comportamento do `distribuidora` (hoje cotação) para um modo
de preço aberto + botão de compra/carrinho — mas sem perder a opção de cotação, porque
outros sites (atuais ou futuros) podem continuar usando ela. Ou seja: cotação e
carrinho passam a ser duas *funcionalidades* alternáveis por site, e futuras
funcionalidades (assistente de IA, banners, etc.) devem seguir o mesmo padrão.

Além disso, o usuário quer **ver visualmente**, numa tela do `apps/admin`, quais
funcionalidades existem e qual está ativa em cada um dos 3 sites — sem precisar abrir
código para saber.

**Fora do escopo desta entrega:** a implementação em si do modo `"cart"` (preço +
botão de compra, página de carrinho, checkout). Isso fica para um spec futuro. Aqui
só criamos o mecanismo de declarar/registrar/visualizar a feature — o modo `"quote"`
continua sendo o único com comportamento real implementado.

**Fora do escopo também:** ativação/desativação pela tela do admin. A tela é somente
leitura; ligar uma funcionalidade em um site continua sendo uma mudança de código
(editar `SITES` em `packages/core`) seguida de deploy. Guardar isso no banco (Supabase)
e permitir toggle ao vivo foi considerado e descartado nesta v1 — decisão explícita do
usuário durante o brainstorming, para não acoplar o mecanismo de features a uma tabela
antes de haver mais de uma funcionalidade real implementada.

## Arquitetura

Novo arquivo **`packages/core/src/features.ts`**, único lugar que all os 3 apps e o
`apps/admin` importam (todos já dependem de `@mypet/core`):

```ts
export type CommerceMode = "quote" | "cart";

export type Features = {
  commerce: CommerceMode;
};

export type FeatureDefinition<T extends string = string> = {
  id: keyof Features;
  label: string;
  description: string;
  options: { value: T; label: string }[];
};

export const FEATURE_REGISTRY: FeatureDefinition[] = [
  {
    id: "commerce",
    label: "Modelo comercial",
    description: "Como o site apresenta preço e converte o visitante em contato/venda.",
    options: [
      { value: "quote", label: "Cotação (preço fechado + WhatsApp)" },
      { value: "cart", label: "Preço + carrinho (não implementado ainda)" },
    ],
  },
];

export type SiteId = "mypet" | "distribuidora" | "azpetshop";

export const SITES: Record<SiteId, { name: string; features: Features }> = {
  mypet: { name: "My Pet Brasil", features: { commerce: "quote" } },
  distribuidora: { name: "Distribuidora Petshop", features: { commerce: "quote" } },
  azpetshop: { name: "MAD PET", features: { commerce: "quote" } },
};
```

`SITES` é a fonte única da verdade: **quem quiser mudar o modo comercial de um site
edita esse objeto**, não o `client.config.ts` do app.

### Integração com `ClientConfig`

`packages/core/src/theme.tsx`: `ClientConfig` ganha o campo `features: Features`
(obrigatório).

Cada `apps/*/client.config.ts` passa a importar de `SITES` em vez de declarar o valor
localmente:

```ts
import { SITES } from "@mypet/core/features";
// ...
export const clientConfig: ClientConfig = {
  // ...campos existentes sem mudança...
  features: SITES.distribuidora.features,
};
```

Nenhum componente de produto/cotação muda de comportamento nesta entrega — hoje só
existe implementação para `"quote"`, e todos os sites permanecem em `"quote"`. O campo
existe para ser lido pelo próximo spec (quando `"cart"` ganhar implementação real).

### Tela da galeria no `apps/admin`

Nova rota `apps/admin/app/(dashboard)/funcionalidades/page.tsx`, Server Component
puro (sem Supabase — os dados vêm de `SITES`/`FEATURE_REGISTRY`, importados
estaticamente de `@mypet/core/features`).

Layout: tabela com uma linha por item de `FEATURE_REGISTRY`, uma coluna por site em
`SITES`. Cada célula mostra o `label` da opção ativa naquele site (ex.: "Cotação
(preço fechado + WhatsApp)"). Sem botões de ação — é um painel de leitura.

Entrada nova no menu lateral (`apps/admin/app/(dashboard)/layout.tsx`, array `NAV`):
"Funcionalidades" → `/funcionalidades`.

Como a tela é só leitura de um módulo TypeScript estático, ela reflete o que está
publicado em produção no momento do build do `apps/admin` — não precisa de
revalidação/cache especial.

## Testes mínimos

- `packages/core`: teste que cada `SiteId` em `SITES` tem todas as chaves de
  `Features` preenchidas (evita esquecer de configurar um novo site).
- `apps/admin`: teste (ou verificação manual, dado que é puramente apresentacional)
  de que a tela renderiza uma célula por combinação feature × site sem lançar erro
  quando um valor não tem `label` correspondente em `options` (fallback: mostra o
  valor bruto).

## Decisões e trade-offs

| Decisão | Motivo |
| --- | --- |
| Fonte da verdade em `packages/core/src/features.ts` (`SITES`), não em cada `client.config.ts` | Evita duplicar o mesmo dado em 3 arquivos e permite que `apps/admin` leia sem import cruzado entre apps (frágil em Next.js/monorepo) |
| Tela do admin é somente leitura nesta v1 | Decisão explícita do usuário: não quer acoplar isso a uma tabela Supabase antes de haver mais de uma feature implementada de verdade |
| Modo `"cart"` entra no tipo mas sem implementação | Escopo definido pelo usuário: detalhar preço+carrinho fica para um spec futuro |
| `Features` é um objeto de chaves fixas, não um array dinâmico de flags soltas | Mais simples de tipar e validar (TypeScript garante que todo site preenche todas as features); suficiente para o número de funcionalidades previsto no curto prazo |

## Próximos passos

1. Revisão deste spec pelo usuário.
2. Plano de implementação (`writing-plans`): (a) criar `features.ts` + atualizar
   `ClientConfig`/`client.config.ts` dos 3 apps, (b) criar a tela `/funcionalidades`
   no admin + entrada de menu, (c) testes mínimos acima.
3. Spec futuro, quando o usuário quiser: implementação real do modo `"cart"` (preço
   aberto, botão de compra, uso do `packages/core/src/cart.ts` já existente).
