# Mypet: vitrines Linha de Fábrica e Catálogo completo

Data: 2026-11-20 · App: `apps/mypet` · Status: aprovado no brainstorming

## Objetivo

O mypet ganha duas vitrines de e-commerce independentes, abertas a qualquer comprador cadastrado:

- **Catálogo completo** (`/catalogo`): portfólio inteiro do canal `mypetbrasil`, frete por zona de SP.
- **Linha de Fábrica** (`/fabrica`): só os produtos de fábrica, frete grátis para todo o Brasil a partir de R$ 299.

Cada vitrine tem o seu carrinho, a sua regra de frete e o seu pedido pelo WhatsApp. Uma não substitui
nem esconde a outra: o mesmo cliente compra nas duas. O `/pedido-rapido` continua como a visão em
tabela do catálogo completo.

Fora do escopo desta versão: pagamento online (Asaas), cotação de transportadora (Melhor Envio),
edição de zonas e valores pelo admin.

## Decisões

| Tema | Decisão |
|---|---|
| Onde | No app `mypet`, religando a vitrine do `/loja`, que já usa o `CatalogSection` do core |
| Produto de fábrica | Ligado ao canal `ffa_fabrica` **e** ao `mypetbrasil` com preço. Preço sempre o do `mypetbrasil` |
| Produto de fábrica fora do mypetbrasil | Não aparece. Para entrar, inclui-se no catálogo mypetbrasil pelo admin |
| Acesso | As duas vitrines para todo comprador cadastrado. A UF não bloqueia nada, só define o frete |
| Localização do cliente | UF, município e CEP do endereço do CNPJ, pela ReceitaWS |
| CNPJ não localizado (fictício) | Tratado como fora de SP: frete sob consulta no catálogo completo |
| Carrinhos | Independentes: `mypet_cart` (catálogo e pedido rápido) e `mypet_cart_fabrica` |

## 1. Dados e consulta de CNPJ

### Migration

`buyers` (tabela compartilhada com `apps/distribuidora`; todas as colunas podem ficar vazias):

- `uf text`, `municipio text`, `cep text`
- `localizacao_status text` com check em (`localizado`, `nao_localizado`); `null` = pendente
- `localizado_em timestamptz`

`orders`:

- `vitrine text` com check em (`catalogo`, `fabrica`), pode ficar vazio (pedidos antigos e de outros apps)
- `shipping_mode text` com check em (`normal`, `prioritaria`, `a_combinar`), pode ficar vazio
- Reaproveita `subtotal`, `shipping_price` e `total` (numeric 12,2, em reais), criadas pela migration
  `20261101120000_retail_checkout.sql`. No frete a combinar, `shipping_price` fica vazio.

A zona **não** é gravada: é calculada a cada leitura, a partir de `uf`, `municipio`, `cep` e
`localizacao_status`.

### Cliente ReceitaWS

`packages/core/src/receitaws.ts`: cópia do cliente de
`Hub Comercial V2/hub-clientes/lib/integracoes/receitaws/client.ts`. É a API pública
`GET https://www.receitaws.com.br/v1/cnpj/{cnpj}`, sem token, com limite de cerca de 3 consultas por
minuto (429 quando passa). Usa só os campos `status`, `uf`, `municipio` e `cep`.

`buyers-server.ts`, função `localizarComprador(supabase, buyer, fetchImpl?)`:

| Resposta | Gravação |
|---|---|
| 200 com `status != "ERROR"` | `localizado`, com `uf`, `municipio` e `cep` (só dígitos), e `localizado_em` |
| 200 com `status == "ERROR"` (CNPJ inválido ou inexistente) | `nao_localizado` e `localizado_em`. Não consulta de novo |
| CNPJ ausente ou fora do formato de 14 dígitos | `nao_localizado` |
| 429, outro HTTP, timeout ou erro de rede | Nada (continua pendente) |

O timeout da consulta é de 5 s. A função nunca lança erro para quem chama.

### Quando consultar

1. **No cadastro** (`apps/mypet/app/api/pre-acesso/route.ts`), depois de criar o comprador, fora do
   caminho da resposta (com `after()` do Next; antes de implementar, conferir a API em
   `node_modules/next/dist/docs/`).
2. **Em qualquer página das vitrines e do pedido rápido**, quando o comprador estiver pendente: dispara
   `localizarComprador` do mesmo jeito, sem esperar. A página daquele acesso usa a zona `fora`.

### Clientes já cadastrados

Script único `scripts/backfill-buyers-localizacao.ts`, rodado localmente:

- lê `leads.cnpj_receita_cache` do projeto Supabase "Clientes" (só leitura);
- para cada comprador pendente com CNPJ no cache:
  - `status_consulta = consultado` com `uf` → `localizado`;
  - `erro` → não marca nada (deixa a consulta ao vivo decidir);
- as credenciais do projeto Clientes vêm de variáveis do terminal e nunca entram no `.env` do mypet;
- opção `--dry-run`, que só mostra as contagens.

## 2. Regras de frete

Funções puras em `packages/core/src/frete.ts`. Os valores ficam em `apps/mypet/lib/frete.config.ts`.
Cálculo interno em centavos, e a conversão para reais só acontece ao gravar em `orders`.

### Zonas

`classificarZona({ uf, municipio, cep, status }, config)` testa nesta ordem e para na primeira que bater:

1. `status` diferente de `localizado` → `fora`
2. CEP dentro de uma faixa de `bairrosProximos` → `bairros_proximos`
3. município São Paulo → `capital`
4. município na lista `grandeSp` (39 municípios da RMSP, ABC incluído) → `grande_sp`
5. município na lista `interior30km` → `interior_30`
6. `uf == "SP"` → `interior_alem`
7. qualquer outra → `fora`

Na comparação de município, maiúsculas, acentos e espaços nas pontas não contam.

Conteúdo inicial da configuração, que o Fábio revisa antes da etapa 3:

- `bairrosProximos`: faixas de CEP de Ipiranga, Sacomã, Cursino, Saúde, Vila Mariana e São João Clímaco
- `grandeSp`: os 39 municípios oficiais da RMSP, menos São Paulo
- `interior30km`: municípios de SP fora da RMSP cuja sede está até 30 km da capital

### Tabela

`calcularFrete({ regra, zona, subtotalCentavos, modalidade }, config)`

**Fábrica** (vale para qualquer zona, inclusive `fora`): grátis a partir de R$ 299,00; abaixo disso,
R$ 19,90 fixo. Só tem entrega normal.

**Catálogo completo:**

| Zona | Frete grátis a partir de | Normal abaixo do mínimo | Prioritária |
|---|---|---|---|
| `bairros_proximos` | R$ 99,00 | R$ 12,99 | R$ 25,00 |
| `capital` | R$ 200,00 | R$ 20,00 | R$ 30,00 |
| `grande_sp` | R$ 300,00 | R$ 25,00 | R$ 35,00 |
| `interior_30` | R$ 400,00 | sob consulta | não tem |
| `interior_alem` | R$ 700,00 | sob consulta | não tem |
| `fora` | não tem | sob consulta | não tem |

Regras:

- O mínimo vale com subtotal **maior ou igual** ao valor.
- A prioritária é sempre paga, mesmo quando a entrega normal já sairia grátis.
- A prioritária existe só em `bairros_proximos`, `capital` e `grande_sp`. O aviso é "pedidos até 12h,
  entrega no mesmo dia sujeita à disponibilidade". Não há trava de horário.
- Prazo da entrega normal: "12h a 48h" nas zonas com taxa; nas zonas sob consulta, não mostra prazo.

Retorno: `{ tipo: "gratis" | "fixo" | "a_combinar", valorCentavos | null, faltaParaGratisCentavos | null,
minimoGratisCentavos | null, prioritariaDisponivel, prazo | null }`.

## 3. Telas e carrinho

### Rotas (todas exigem comprador; sem cadastro, redireciona para `cadastroHref(...)`)

| Rota | Conteúdo | Carrinho |
|---|---|---|
| `/catalogo` | Vitrine do portfólio completo (corpo do `/loja` atual, sem o redirecionamento) | `mypet_cart` |
| `/pedido-rapido` | Tabela atual, com a barra de frete do catálogo | `mypet_cart` |
| `/fabrica` | Vitrine com o recorte de fábrica | `mypet_cart_fabrica` |
| `/fabrica/produtos/[id]` | Reaproveita a página de produto, com o recorte | `mypet_cart_fabrica` |
| `/fabrica/categoria/[slug]` | Reaproveita a página de categoria, com o recorte | `mypet_cart_fabrica` |
| `/fabrica/cotacao` | Reaproveita a finalização, com a regra da fábrica | `mypet_cart_fabrica` |
| `/loja` | Redireciona para `/catalogo` | |

Se um produto não for de fábrica, `/fabrica/produtos/[id]` responde 404.

### Carrinhos independentes

- `CartProvider` (`packages/core/src/components/cart-provider.tsx`) recebe `storageKey`, com padrão
  `"mypet_cart"`. Assim os outros apps não mudam e ninguém perde o carrinho que já tem.
- `apps/mypet/app/fabrica/layout.tsx` envolve as páginas com um `CartProvider storageKey="mypet_cart_fabrica"`.
  O contexto mais interno vence, e os componentes de produto e de carrinho não mudam.

### Recorte de fábrica no catálogo

`packages/core/src/catalog.ts`: as funções de lista, categorias, marcas, contagem e produto por id ganham
o parâmetro opcional `alsoInChannel?: Channel`. Quando informado, o produto também precisa estar ligado
a esse canal em `product_channel_links` (embed com alias e `!inner`). O preço continua vindo de `channel`.
A configuração da vitrine de fábrica passa `channel: "mypetbrasil", alsoInChannel: "ffa_fabrica"`.

### Configuração das vitrines

`apps/mypet/lib/vitrines.ts`:

```ts
type Vitrine = {
  id: "catalogo" | "fabrica";
  rotulo: string;              // "Catálogo completo" | "Linha de Fábrica"
  basePath: string;            // "" | "/fabrica"
  alsoInChannel?: Channel;     // fábrica: "ffa_fabrica"
  regraFrete: "zona" | "fabrica";
};
```

As páginas recebem a vitrine e repassam a configuração para o catálogo, a faixa de frete e a finalização.

### Interface

- **Faixa no topo de cada vitrine**, montada pelo servidor:
  - fábrica: "Frete grátis para todo o Brasil acima de R$ 299";
  - catálogo, cliente localizado: "Sua região: <zona> · frete grátis a partir de R$ X";
  - catálogo, zona `fora`: "Frete sob consulta para a sua região".
- **Barra do carrinho:**
  - "Faltam R$ X para o frete grátis", ou "Frete grátis garantido";
  - no catálogo, escolha entre entrega normal e prioritária quando a zona permite;
  - total com o frete.
- **`HubNav`:** abas "Catálogo", "Linha de Fábrica" e "Tabela de Preços".
- **Copy:** sem "loja", "atacado" e "cotação" em qualquer texto visível (regra do mypet).

### Finalização do pedido

`finalizeQuote(items, { vitrine, modalidade, agentConversationId })`:

1. `requireBuyer()`, e calcula a zona a partir do comprador (servidor, nunca do navegador).
2. `parseCheckoutLines` (`retail-checkout.ts`) valida os itens.
3. `priceCart(supabase, "mypetbrasil", lines, { alsoInChannel, checkStock: false })` recalcula com o
   preço do banco. Ganha duas opções:
   - `alsoInChannel`: recusa item fora do recorte;
   - `checkStock`: padrão `true`, para não mudar o azpetshop. No mypet vai `false`, porque o mypet não
     bloqueia pedido por falta de estoque.
4. `calcularFrete` com o subtotal recalculado. Se a modalidade pedida não estiver disponível, cai para
   `normal`.
5. `createOrder` grava os itens com o preço recalculado, mais `vitrine`, `shipping_mode`, `subtotal`,
   `shipping_price` e `total`. No frete a combinar, `shipping_mode = a_combinar` e
   `total = subtotal`.
6. Devolve para a tela os valores recalculados. A mensagem do WhatsApp (`whatsapp-order.ts`) é montada
   com eles:
   - primeira linha: "Pedido · Catálogo completo" ou "Pedido · Linha de Fábrica";
   - ao final: zona, modalidade e "Frete: grátis", "Frete: R$ X" ou "Frete: a combinar".

Se o preço recalculado for diferente do que estava no carrinho, valem os valores do servidor, e a tela
atualiza o carrinho antes de abrir o WhatsApp.

## 4. Testes

- `frete.test.ts`:
  - `classificarZona`: um caso por zona, CEP de bairro próximo vencendo o município, município com
    acento e caixa diferentes, e `pendente` e `nao_localizado` caindo em `fora`;
  - `calcularFrete`: abaixo, exatamente no mínimo e acima, nas duas regras; prioritária paga com frete
    grátis; prioritária indisponível fora das zonas; fábrica igual em todas as zonas.
- `receitaws.test.ts` e `buyers-server.test.ts` (fetch simulado): localizado, `ERROR` vira
  `nao_localizado`, CNPJ inválido, 429, timeout e erro de rede não gravam nada.
- `retail-checkout-server.test.ts`: `alsoInChannel` recusa item fora do recorte; com `checkStock: false`,
  não recusa item sem estoque; o comportamento padrão do azpetshop não muda.
- `catalog.test.ts`: `alsoInChannel` aplicado em lista, categorias, marcas, contagem e produto.
- `cart-provider`: chaves diferentes não se misturam; sem `storageKey`, usa `mypet_cart`.
- `apps/mypet`: finalização grava vitrine, modalidade e valores recalculados; `/fabrica/produtos/[id]`
  de produto que não é de fábrica dá 404; `/loja` redireciona para `/catalogo`; teste de copy sem
  "loja", "atacado" e "cotação" nas páginas novas.

## 5. Entrega

Cada etapa pode ir para a main sozinha:

1. Migration, `receitaws.ts`, `localizarComprador`, consulta no cadastro e no acesso, script de
   preenchimento. Nada aparece para o cliente.
2. `frete.ts` e `frete.config.ts`, com zonas, faixas de CEP e municípios. **O Fábio revisa as listas.**
3. `/catalogo` religado, com a faixa, a barra de frete, a finalização recalculada no servidor e a barra
   no `/pedido-rapido`.
4. `/fabrica`, com carrinho próprio, recorte no catálogo e as páginas internas.
5. `HubNav`, redirecionamento do `/loja` e revisão da copy.

Passos manuais:

- aplicar a migration no Supabase `hub_catalogo`;
- rodar o script de preenchimento (`--dry-run` antes);
- revisar as faixas de CEP e a lista do interior até 30 km;
- testar no navegador as duas vitrines com um comprador de SP e outro de fora.

## Riscos

- **Limite da ReceitaWS (cerca de 3/min):** num pico de cadastros, parte dos compradores fica pendente
  e vê frete sob consulta até o próximo acesso. É aceitável, porque o fechamento passa pelo WhatsApp.
- **Endereço do CNPJ diferente do de entrega:** o frete exibido é uma referência, e o WhatsApp corrige
  o caso.
- **`buyers` compartilhada com o distribuidora:** as colunas novas podem ficar vazias e o distribuidora
  não lê nenhuma delas.
