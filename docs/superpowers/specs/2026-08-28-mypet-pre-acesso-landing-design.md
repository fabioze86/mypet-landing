# Landing de pré-acesso B2B da My Pet

**Data:** 2026-08-28  
**Status:** Aprovado para planejamento  
**Escopo:** `apps/mypet`

## Objetivo

Transformar a rota pública da My Pet em uma landing de pré-acesso que educa e qualifica lojistas antes de eles entrarem no e-commerce B2B. A página deve responder às dúvidas comerciais que hoje chegam ao WhatsApp - especialmente pedido mínimo, descontos por volume, frete, pagamento e prazo de entrega - e levar o lead apto a criar acesso à loja.

O resultado esperado é reduzir conversas repetitivas no WhatsApp sem criar atrito para um visitante que já tem intenção de compra.

## Decisões aprovadas

- O mesmo domínio hospeda os dois destinos.
- `/` é a landing pública de educação e qualificação.
- O e-commerce atual sai de `/` e passa para `/loja`.
- O cadastro é estritamente composto por CNPJ, e-mail e WhatsApp.
- A aprovação é automática; após o envio válido, o visitante recebe uma sessão de acesso e segue diretamente para `/loja`.
- As condições comerciais começam como placeholders centralizados no código e são substituíveis sem alterar a interface.
- Preços e compra são acessíveis apenas depois de uma sessão aprovada. Preços não podem compor o HTML ou o bundle público.

## Jornada do visitante

```text
Anúncio / busca / indicação
  -> / (landing pública)
  -> entende as condições comerciais
  -> explora categorias, FAQ, prova social e conteúdo útil
  -> "Criar acesso à loja"
  -> cadastro (CNPJ, e-mail, WhatsApp)
  -> validação e criação automática de sessão
  -> /loja (e-commerce com preços visíveis)
```

Clientes que já possuem acesso podem usar a ação "Entrar" no cabeçalho e seguir diretamente para `/loja`.

## Estrutura da landing

### 1. Hero

Objetivo: responder em segundos o que a My Pet vende, para quem, por que comprar e qual é o próximo passo.

- Contexto: atacado para pet shops.
- Mensagem principal: abastecer a loja com segurança e condições claras.
- CTA principal: `Conhecer as condições` com rolagem para as regras comerciais.
- CTA secundário: `Já tenho cadastro`, apontando para a entrada da loja.

### 2. Condições comerciais

Três blocos em destaque e legíveis no primeiro percurso da página:

- pedido mínimo;
- desconto progressivo por volume;
- entrega, frete e prazo.

Os textos usam valores de exemplo somente na configuração de desenvolvimento. A interface final não deve exibir expressões como "a definir" ou "placeholder".

### 3. Cards de educação

Faixa de cards navegável horizontalmente, principalmente em mobile, para aprofundar sem tornar o hero excessivo:

- Como funciona a compra;
- Condições de compra;
- Categorias disponíveis;
- Entrega e pagamento.

Cada card leva a uma seção da mesma página ou abre conteúdo curto em contexto. Não há navegação para WhatsApp nesta etapa.

### 4. Categorias mais procuradas

Apresenta categorias do catálogo sem preço, com links para a experiência após o acesso. O propósito é permitir que o lead reconheça rapidamente se a My Pet atende seu mix de produtos.

### 5. FAQ comercial

Accordion com prioridade para perguntas que evitam mensagens repetitivas:

- Qual é o pedido mínimo?
- Há desconto para compras em maior quantidade?
- A My Pet vende para pessoa física?
- Quais são as formas de pagamento?
- Como é calculado o frete e quais regiões são atendidas?
- Qual é o prazo de entrega?
- Preciso de CNPJ para comprar?
- Como acesso os preços?

### 6. Confiança e conteúdo

- prova social de lojistas, com depoimentos reais somente quando autorizados;
- indicadores institucionais que possam ser comprovados;
- artigos ou guias úteis de compra e revenda, quando houver conteúdo editorial válido.

Não criar depoimentos, números ou selos fictícios para produção.

### 7. Conversão e formulário

O CTA `Criar acesso à loja` abre uma etapa de cadastro ou navega a uma página própria de cadastro simplificado. Campos, nesta ordem:

1. CNPJ;
2. e-mail;
3. WhatsApp.

Depois de uma resposta bem-sucedida, a interface confirma a liberação e leva o usuário a `/loja`. O formulário inclui texto de consentimento e link para a política de privacidade.

## Componentes e responsabilidades

Estrutura sugerida em `apps/mypet/app`:

```text
app/
  page.tsx                         # composição da landing pública
  loja/page.tsx                    # e-commerce protegido
  entrar/page.tsx                  # entrada para clientes existentes, se necessário
  _components/pre-access/
    hero.tsx
    commercial-conditions.tsx
    education-cards.tsx
    popular-categories.tsx
    commercial-faq.tsx
    social-proof.tsx
    content-hub.tsx
    access-form.tsx
  api/access/route.ts              # valida, registra e cria sessão
lib/
  pre-access-content.ts             # conteúdo e placeholders comerciais
  access/
    schema.ts
    service.ts
    session.ts
```

O conteúdo comercial deve ser uma configuração tipada única, para que valores, faixas e respostas possam ser trocados sem procurar textos espalhados por componentes.

Os componentes visuais reutilizam os tokens e elementos compartilhados de `@mypet/core` quando isso não comprometer a clareza da landing. A landing não deve importar dados de preço nem componentes que os carreguem.

## Dados, sessão e proteção de acesso

1. O formulário envia CNPJ, e-mail e WhatsApp para uma rota server-side.
2. O servidor normaliza e valida os três campos.
3. O lead é registrado no fluxo existente do canal My Pet, com a origem identificada como pré-acesso quando o esquema permitir.
4. O servidor cria uma sessão segura de acesso.
5. O navegador recebe apenas a confirmação necessária e navega para `/loja`.
6. `/loja` verifica a sessão no servidor antes de buscar catálogo protegido ou preços.

O navegador nunca decide a autorização apenas com um estado React, `localStorage` ou parâmetro de URL. Não enviar preços, listas de preço ou dados comerciais protegidos para visitantes de `/`.

## Validação, erros e antiabuso

Validações mínimas:

- CNPJ obrigatório e com formato válido;
- e-mail obrigatório e normalizado;
- WhatsApp obrigatório, normalizado para dígitos e validado com DDI/DDD esperado;
- limites de tamanho em todos os campos;
- proteção contra reenvios rápidos e abuso automatizado.

Respostas visíveis devem ser breves e acionáveis:

- dados inválidos: indicar que o campo precisa de correção;
- serviço indisponível: orientar nova tentativa em instantes;
- limite excedido: informar para aguardar antes de tentar novamente.

Erros internos, credenciais e dados pessoais não são expostos ao navegador ou gravados integralmente em logs. A implementação deve incluir consentimento e política de privacidade antes da coleta em produção.

## Métricas de funil

Eventos sem dados pessoais:

- visualização da landing;
- clique em condições comerciais;
- abertura de uma resposta do FAQ;
- início do cadastro;
- cadastro concluído;
- redirecionamento e chegada em `/loja`.

Esses eventos permitem identificar onde o lead deixa o fluxo sem usar CNPJ, e-mail ou telefone como identificadores analíticos.

## SEO e acessibilidade

- metadados específicos para atacado B2B My Pet;
- uma única hierarquia `h1` por página e títulos semânticos;
- FAQ elegível para marcação estruturada somente se refletir conteúdo visível e verdadeiro;
- imagens com texto alternativo e dimensões definidas;
- foco visível, navegação por teclado e accordions com atributos ARIA;
- boa leitura e CTAs em tela móvel antes de otimização para desktop.

## Critérios de aceite e testes

- `/` mostra a landing e não expõe preços no HTML público;
- `/loja` redireciona ou bloqueia visitante sem sessão válida;
- cadastro válido cria acesso e redireciona para `/loja`;
- CNPJ, e-mail ou WhatsApp inválidos impedem o envio e explicam a correção;
- falhas da API exibem feedback genérico e não criam um estado de acesso indevido;
- FAQ, cards e CTA funcionam com teclado e em telas pequenas;
- as condições comerciais vêm de uma única configuração;
- lint, testes relevantes e build do app passam;
- revisão manual cobre a jornada completa em mobile e desktop.

## Fora de escopo nesta etapa

- valores comerciais definitivos;
- criação de depoimentos ou artigos fictícios;
- WhatsApp como CTA primário;
- cálculo real de frete, desconto ou crédito;
- substituição do ERP, CRM ou fonte de catálogo;
- mudança de regras comerciais por perfil de cliente.
