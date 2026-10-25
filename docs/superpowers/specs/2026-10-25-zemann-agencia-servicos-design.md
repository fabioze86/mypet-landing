# Zemann — de consultoria de Amazon para agência com módulos de serviço

Data: 2026-10-25. Base: [2026-10-17-zemann-site-amazon-design.md](2026-10-17-zemann-site-amazon-design.md)
(tudo o que não for alterado aqui continua valendo, inclusive as restrições globais).

## 1. Objetivo

O site `apps/zemann` foi feito só para a consultoria de Amazon. A Amazon passa a ser um
módulo (o carro-chefe) de uma agência com 8 serviços. O site ainda não foi publicado,
então não há URL indexada a preservar além das que já existem no código.

## 2. Decisões

| Tema | Decisão |
|---|---|
| Posicionamento | Agência de crescimento para marcas e e-commerces, com a Amazon como carro-chefe. |
| Público | Marcas, indústrias e lojas que vendem online (o mesmo da Amazon). |
| Serviços | Amazon + SEO, Tráfego pago (Performance), CRO, E-mail marketing, UX, Social media, Assessoria. Lista inspirada em etraction.com.br, sem Influencers e Design gráfico. |
| Profundidade | Cada serviço novo tem página própria. |
| URLs | As URLs atuais ficam. Serviços novos na raiz, com URL descritiva. |
| Papel da Amazon na home | Faixa própria em destaque, com números, comparativo, etapas da oferta e cases. |
| Quem executa | "Nosso time" (a copy pode falar em time). |

## 3. Mapa de páginas

```
/                                   Home da agência                       (alterada)
/consultoria-amazon-para-marcas     Módulo Amazon                         (sem mudança de URL)
/consultoria-amazon-para-sellers    Módulo Amazon                         (sem mudança de URL)
/diagnostico-conta-amazon           Módulo Amazon                         (sem mudança de URL)
/seo-para-ecommerce                 SEO                                   (nova)
/trafego-pago-para-ecommerce        Tráfego pago (Performance)            (nova)
/cro-otimizacao-de-conversao        CRO                                   (nova)
/email-marketing-para-ecommerce     E-mail marketing                      (nova)
/ux-para-ecommerce                  UX                                    (nova)
/social-media-para-marcas           Social media                          (nova)
/assessoria-de-marketing-digital    Assessoria                            (nova)
/cases, /cases/<slug>               Sem mudança (cases já cruzam serviços)
/guias, /guias/<slug>               Sem mudança
/perguntas-frequentes               Alterada: perguntas da agência + bloco Amazon
/sobre                              Alterada: agência e time
/contato                            Alterada: campo "Serviço de interesse"
```

## 4. Navegação

Mega menu com 4 grupos:

- **Amazon**: Para marcas, Para sellers, Diagnóstico.
- **Serviços**: os 7 serviços novos.
- **Recursos**: Guias, Cases, Perguntas frequentes.
- **Empresa**: Sobre, Contato.

O rodapé ganha a coluna "Serviços". A barra utilitária não muda.

## 5. Home

Ordem das seções:

1. Hero da agência: título grande à esquerda (crescimento de vendas online para marcas e
   e-commerces), ilustração à direita, CTA "Fale com um especialista".
2. Grade dos 8 serviços em cartões (nome, uma linha, link). O cartão da Amazon fica
   em primeiro e visualmente destacado.
3. Faixa Amazon em destaque: título próprio, a faixa de números atual, o comparativo
   e as etapas da oferta (diagnóstico → implantação → gestão), com link para marcas,
   sellers e diagnóstico.
4. Cases (os publicados).
5. Fechamento com 3 caminhos: diagnóstico Amazon, guias, falar com o time.

Título da home (≤ 55): "Zemann — Agência de crescimento para e-commerce".

## 6. Página de serviço (modelo único)

Seções, nesta ordem:

1. Hero: H1, parágrafo de abertura, CTA para `/contato?servico=<chave>`.
2. Para quem é (2 a 4 perfis).
3. O que inclui (4 a 6 cartões).
4. Como funciona (3 a 4 etapas).
5. Como se conecta aos outros serviços (2 a 3 links internos, ex.: SEO ↔ CRO,
   tráfego pago ↔ Amazon Ads).
6. Perguntas frequentes (3 a 5).
7. CTA final.

Dados estruturados: `Service` (provider = organização), `FAQPage`, `BreadcrumbList`.
Imagem Open Graph própria por página.

## 7. Arquitetura

- `lib/services.ts`: catálogo dos 7 serviços novos (chave, caminho, nome, título,
  descrição, abertura, perfis, itens, etapas, conexões, FAQ) e a lista dos 8 serviços
  para a grade da home, o menu e o formulário (o item Amazon aponta para as páginas
  existentes).
- `app/_components/service-page.tsx`: renderiza qualquer serviço a partir do catálogo.
- Cada rota nova: `page.tsx` curto (metadata + `<ServicePage service={...} />`) e
  `opengraph-image.tsx`. Rotas estáticas e explícitas, sem rota coringa na raiz.
- `lib/pages.ts` e `MENU_GROUPS` passam a incluir o grupo Serviços (lido do catálogo).
- `lib/site-index.ts`: serviços entram no sitemap e no `llms.txt` (seção "Serviços").
- `site.config.ts`: tagline da agência. JSON-LD da organização: `knowsAbout` com os
  8 serviços.

## 8. Formulário

- Campo opcional "Serviço de interesse" (select com os 8 serviços + "Ainda não sei").
- Pré-preenchido por `?servico=<chave>`; chave desconhecida é ignorada.
- Validação no servidor: só aceita chave do catálogo. O nome do serviço entra no
  assunto do e-mail. "Seu desafio" continua obrigatório.

## 9. Copy

Somam-se às regras do spec base:

- Textos próprios. Não copiar frases nem estrutura de texto da eTraction.
- Nenhum resultado, número, cliente ou case inventado para os serviços novos. A prova
  com números continua só no módulo Amazon e nos cases.
- Proibido citar selos que a Zemann não tem ("Google Partner", "Meta Business Partner"
  e similares), além do que já é proibido sobre a Amazon.
- Pode usar "nosso time".
- Títulos ≤ 55 caracteres e descrições ≤ 160, como no restante do site.

## 10. Testes

- `lib/services.test.ts`: caminhos únicos e sem colisão com `PAGES`; título ≤ 55;
  descrição ≤ 160; sem palavras proibidas (Amazon, selos, "parceiro oficial");
  toda conexão aponta para um serviço existente.
- Sitemap e `llms.txt` contêm as 7 URLs novas.
- Formulário: chave de serviço válida vai para o assunto; chave inválida é rejeitada;
  pré-preenchimento por query.
- Ajuste dos testes da home, do menu e do rodapé.

## 11. Fora de escopo

- Cases e guias dos serviços novos (entram depois, com dados reais).
- Página-índice `/servicos` (a grade da home e o menu cumprem esse papel).
- Mudança das URLs do módulo Amazon.
