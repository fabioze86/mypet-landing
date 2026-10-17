# Zemann — site de consultoria Amazon (`apps/zemann`)

Data: 2026-10-17
Status: aprovado em brainstorming; aguardando revisão do spec

## Contexto

O zemann.com.br hoje é uma landing de página única de "IA aplicada e automação sob
medida" (serviços genéricos, cases demonstrativos, formulário SMTP). A Zemann muda de
foco: **consultoria de Amazon "mão na massa" para marcas e sellers**, com dados e IA como
diferencial do método. O site também serve de portfólio de AI/Platform PM do Fábio
(cases em formato de estudo de produto).

Prova real que sustenta o posicionamento:

- **My Pet Brasil** vende na Amazon (Vendor `MYQE9`), operada pelo Fábio.
- **Hub Amazon** (`C:\Projetos\Hub Amazon`, Vendor, multi-tenant): cadastro em escala
  (template `.xlsm` + molde por ASIN + agente de rascunho), otimização de listing com
  guia de voz por marca e fluxo prévia validada → aprovação → publicação via SP-API com
  auditoria, diagnóstico de saúde de listings, rentabilidade por PO, confirmação de PO,
  Data Kiosk, Ads (Sponsored Products), A+ via API (em construção). Opera My Pet e
  Feitiços (cliente); catálogos Mini Toys e PetToys.
- **Hub Amazon Seller** (`C:\Projetos\Hub Amazon Seller`, 3P): controle de anúncios,
  vendas e tarifas, lucratividade estimada × real por SKU, vínculo com ERP.

Pesquisa de palavras-chave (Brasil, out/2025–set/2026): termos de oferta têm volume
baixo ("consultoria amazon" 40/mês, "mentor amazon" 110); topo de funil ("como vender na
amazon" 2.900) é concorrido e em queda; "vendor amazon" (720) e termos de seller
estabelecido (buy box, listing, ads) têm melhor encaixe e concorrência menor. Conclusão:
o SEO dá credibilidade e captura demanda de nicho; não enche a agenda sozinho.

## Decisões

| Tema | Decisão |
|---|---|
| Propósito | Híbrido: a Zemann vende consultoria; cases como estudo de produto servem a clientes e recrutadores. |
| Domínio | `apps/zemann` substitui o zemann.com.br atual (mesmo domínio). |
| Público | (A) indústrias e marcas próprias (seller 3P ou vendor) e (B) sellers estabelecidos, com páginas separadas. |
| Marketplace | Só Amazon. Mercado Livre fora. |
| Oferta | Escada: **Diagnóstico da conta** (pago, preço "a partir de" publicado) → **Implantação** (projeto 30–90 dias, sob consulta) → **Gestão contínua** (mensalidade, sob consulta). |
| Provas | My Pet com nome (qualitativo no lançamento, números quando houver). Feitiços com nome, mediante autorização do cliente. |
| Hubs | Apresentados como ferramenta do método, não como SaaS. Sem telas com dados de cliente. |
| Conteúdo | 2–4 guias/mês escritos com o Fábio, em MDX no repositório. |
| Stack | Next.js 16.3.8 + React 19 + Tailwind 4 + Vitest, SSG, deploy próprio na Vercel. |
| Isolamento | Não depende de `@mypet/core` nem do Supabase `hub_catalogo` (outra empresa). |
| E-mail | SMTP do site atual. |
| Demo do agente | Fase 2. |
| Layout | Estrutura do site da Cloudflare (pt-br): barra utilitária, mega menu (Soluções, Recursos, Empresa), hero com título grande e ilustração, faixa de números, cartões com borda fina e cantos pouco arredondados, CTA final em 3 cartões, rodapé escuro em colunas. Sem copiar textos, imagens ou marca. |
| Paleta | Azul-petróleo, só via tokens: texto `#0B1220`, secundário `#334155`, apoio `#64748B`, borda `#E2E8F0`, fundo de seção `#F5F7FA`, destaque `#0E7490`, hover `#155E75`, destaque suave `#CFFAFE`, rodapé `#0B1220`. |

## 1. Posicionamento

> **Zemann — consultoria de Amazon "mão na massa" para marcas e sellers.** Quem opera uma
> marca na Amazon estrutura catálogo, anúncios e dados — e executa com você.

**Quatro pilares** (home e páginas de público):

1. **Operador, não teórico** — vendemos nossa própria marca na Amazon todos os dias.
2. **Tecnologia própria conectada à API oficial da Amazon (SP-API)** — cadastro e
   correção em escala, sem planilha manual.
3. **Margem, não só faturamento** — lucro estimado × real por SKU.
4. **Nada vai ao ar sem sua aprovação** — a Amazon valida a prévia, você aprova,
   tudo fica auditado.

**Tabela comparativa** na home: Zemann × agência × curso/mentoria, com as linhas
"executa junto", "ferramentas via API", "margem por SKU", "atende Vendor e Seller",
"aprovação antes de publicar".

**Copy proibida:** "parceiro oficial Amazon" ou qualquer insinuação de vínculo com a
Amazon. Usar "conectado à API oficial da Amazon". Rodapé com aviso: Amazon é marca
registrada da Amazon.com, Inc.; a Zemann não é afiliada à Amazon.

## 2. Mapa de páginas

| URL | Papel | Alvo de busca |
|---|---|---|
| `/` | Proposta, pilares, prova (My Pet), comparativo, escada de oferta, CTA do diagnóstico | marca + "consultoria amazon" |
| `/consultoria-amazon-para-marcas` | Entrada/crescimento de indústrias e marcas: 3P × vendor, catálogo, registro de marca | "vendor amazon", "consultoria amazon", "amazon para vendedores" |
| `/consultoria-amazon-para-sellers` | Sellers que estagnaram: Buy Box, Ads, listing, margem | "buy box amazon", "amazon ads", "otimização de anúncios amazon" |
| `/diagnostico-conta-amazon` | Produto de entrada: o que é auditado, exemplo anonimizado do relatório (compráveis × visíveis, pendências por código, imagens quebradas, margem por SKU), prazo, preço "a partir de", formulário | "auditoria/diagnóstico conta amazon" |
| `/cases`, `/cases/[slug]` | Estudos de produto (problema → solução → impacto) | — |
| `/guias`, `/guias/[slug]` | Guias perenes assinados pelo Fábio | termos informativos (seção 3) |
| `/perguntas-frequentes` | Prazo, preço, o que é executado × o que fica com o cliente, acesso à conta, vendor × seller, resultado esperado | AEO |
| `/sobre` | Fábio: operador de marca na Amazon com dados e IA; trajetória; LinkedIn | entidade e autor (E-E-A-T) |
| `/contato` | Conversa para implantação e gestão | — |
| `/llms.txt`, `/sitemap.xml`, `/robots.txt` | Infraestrutura | — |

**Cases na v1:** My Pet na Amazon (principal), Feitiços (página com o "antes" do
diagnóstico; "depois" quando o ciclo dos 20 ASINs fechar; publicada só após autorização),
Catálogo Hub, Hub Comercial, Agente My Pet.

**Fora da v1:** Mercado Livre, demo do agente, curso/mentoria em grupo, páginas por
categoria de produto, inglês, pagamento online do diagnóstico.

**Redirects:** o site atual só tem âncoras; conferir no Search Console se há alguma URL
indexada a redirecionar antes da troca.

## 3. Estratégia de conteúdo

**Guias** (prioridade por encaixe com o público, concorrência baixa e tendência):

| # | Guia | Palavras-chave (volume/mês) | Leva para |
|---|---|---|---|
| 1 | Vendor ou seller na Amazon: qual modelo serve para sua marca | vendor amazon (720), amazon para vendedores (140) | /marcas |
| 2 | Buy Box na Amazon: como funciona e por que você perde | buy box amazon (140) | /sellers |
| 3 | FBA na Amazon Brasil: como funciona e quando vale a pena | fba amazon como funciona (110), amazon fba (1.600) | /sellers |
| 4 | Listing na Amazon: anatomia de um anúncio que converte | listing amazon (40), otimização de anúncios (50), como anunciar (110) | diagnóstico |
| 5 | Amazon Ads para marcas: estrutura de campanhas que funciona | amazon ads (1.600) | /sellers |
| 6 | Catálogo estruturado: o que muda nas vendas quando os dados do produto são bons | diferencial | case Catálogo Hub |
| 7 | Por que meu produto não aparece (ou não está à venda) na Amazon | supressão, pendências de listing | diagnóstico |

Na v1 entram os guias 1 e 2; os demais na v1.1 em diante, no ritmo de 2–4/mês.

**Excluídos de propósito:** vender sem estoque, com CPF, afiliados, KDP/livros,
login/Seller Central, taxas e "precisa de CNPJ". Servem de palavras negativas em
Google Ads.

**Formato obrigatório de todo guia:**
1. Resposta direta de 2–3 frases logo abaixo do título (campo `answer` do frontmatter).
2. Tabela ou passo a passo quando couber.
3. Ao menos um dado ou exemplo real da operação (My Pet ou cliente autorizado).
4. Seção "Perguntas frequentes" no fim, marcada como `FAQPage`.
5. Autor, data de publicação e data de atualização visíveis e no schema.

**Distribuição:** cada guia vira post no LinkedIn do Fábio. **Pago (fora do site,
opcional):** Google Ads em "consultoria/mentor amazon" e "vendor amazon" apontando para
`/diagnostico-conta-amazon`.

## 4. Arquitetura técnica

**App:** `apps/zemann`, porta 4106, scripts `dev`/`build`/`start`/`test` como os demais;
adicionar `dev:zemann` no `package.json` raiz e o link no `apps/hub`. Projeto Vercel
próprio com root `apps/zemann`. Antes de codar, ler os guias de
`node_modules/next/dist/docs/` sobre metadata, sitemap/robots, MDX, Server Actions e
geração de imagem OG (AGENTS.md).

**Conteúdo:** `apps/zemann/content/guias/*.mdx` e `content/cases/*.mdx`. Frontmatter
validado no build (falha o build se inválido):

```ts
type Frontmatter = {
  title: string;          // H1
  description: string;    // meta description, ≤ 160 caracteres
  answer: string;         // resposta direta exibida abaixo do H1
  author: "fabio";        // chave do autor (dados em lib/authors.ts)
  publishedAt: string;    // ISO yyyy-mm-dd
  updatedAt: string;      // ISO yyyy-mm-dd, ≥ publishedAt
  faq?: { q: string; a: string }[];
  draft?: boolean;        // true não gera página nem entra no sitemap
};
```

Cases acrescentam `client`, `problem`, `solution`, `impact` (texto) e `authorized:
boolean` (case com `authorized: false` não é publicado).

**Estrutura de código (unidades):**

| Unidade | Responsabilidade |
|---|---|
| `lib/content.ts` | Lê e valida MDX + frontmatter; lista guias/cases publicados |
| `lib/seo.ts` | Monta `Metadata` (title, description, canonical, OG) |
| `lib/jsonld.ts` | Builders puros de JSON-LD: `Organization`, `WebSite`, `Person` (`sameAs` LinkedIn), `ProfessionalService`/`Service` + `Offer` (diagnóstico "a partir de"), `Article`, `FAQPage`, `BreadcrumbList` |
| `lib/contact.ts` | Validação do formulário e envio SMTP |
| `app/sitemap.ts` | URLs com `lastModified` real (`updatedAt`) |
| `app/robots.ts` | Libera tudo, incluindo GPTBot, ClaudeBot, PerplexityBot, Google-Extended |
| `app/llms.txt/route.ts` | Gera `llms.txt` a partir das páginas e do conteúdo |
| `app/**/opengraph-image.tsx` | Imagem OG por página |

**HTML/AEO:** HTML semântico, perguntas como H2, conteúdo essencial renderizado no
servidor (nada atrás de JavaScript), tabelas em `<table>` real.

**Formulários** (`/diagnostico-conta-amazon` e `/contato`): Server Action que valida
(nome, e-mail, empresa, URL da loja ou marca na Amazon opcional, perfil
marca/seller, "Seu desafio" — **obrigatório e marcado como obrigatório**), descarta
envios com honeypot preenchido e envia e-mail via SMTP (`SMTP_HOST`, `SMTP_PORT`,
`SMTP_USER`, `SMTP_PASS`, `CONTACT_TO` em `.env.local`/Vercel). Falha no envio mostra
erro visível e mantém os dados no formulário. Sucesso mostra "resposta em até 1 dia útil".

**Medição:** GA4 no padrão do azpetshop (só produção, fora de preview), eventos
`generate_lead` (envio de formulário, com `form` = diagnostico/contato) e `click_cta`.
Search Console verificado no domínio. Acompanhamento mensal manual de AEO: perguntas-alvo
testadas no ChatGPT, Perplexity e Google (AI Overviews), registrando se a Zemann aparece.

**Testes (Vitest):** validação de frontmatter (válido, inválido, draft, case não
autorizado); builders de JSON-LD; validação e Server Action do formulário (SMTP
mockado: sucesso, falha, honeypot, campo obrigatório). Verificação final: `pnpm
--filter zemann build` sem erro e conferência do HTML gerado (JSON-LD presente, canonical,
sitemap e robots).

## 5. Fases

- **v1:** todas as páginas do mapa, os cases autorizados, guias 1 e 2, formulários,
  SEO/AEO técnico, GA4.
- **v1.1+:** guias 3–7 no ritmo de 2–4/mês; números dos cases quando houver.
- **Fase 2:** demo do agente ("Pergunte ao agente da Zemann").

## 6. Insumos que o Fábio fornece

- Preço "a partir de" do diagnóstico e prazo de entrega.
- Credenciais SMTP do site atual.
- URL do LinkedIn, razão social e CNPJ da Zemann, foto para `/sobre`.
- Autorização da Feitiços (por escrito) e números dos cases quando disponíveis.
- ID da propriedade GA4 (nova, da Zemann).
- Acesso ao DNS/Vercel para apontar o domínio na troca.

## 7. Fora deste spec

- Segurança do Hub Amazon: `.env` e `data/hub-db.json` estão versionados naquele
  repositório; tratar em sessão própria (remover do git e rotacionar credenciais).
