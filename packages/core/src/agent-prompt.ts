import type { ArtigoAjuda } from "./help-center";

export type AgentMode = "visitante" | "cliente";
export type AgentFaqItem = { readonly q: string; readonly a: string };
export type AgentCartItem = { id: string; name: string; qty: number; unitPrice: number | null };

const MAX_ARTICLE_CHARS = 4000;
const MAX_KNOWLEDGE_CHARS = 60000;

export function formatKnowledge(faq: readonly AgentFaqItem[], artigos: ArtigoAjuda[]): string {
  const parts = faq.map((item) => `### ${item.q}\n${item.a}`);
  for (const artigo of artigos) {
    const corpo = artigo.corpoMarkdown.slice(0, MAX_ARTICLE_CHARS);
    parts.push(`### ${artigo.titulo} (artigo: /central-de-ajuda/a/${artigo.slug})\n${corpo}`);
  }

  let total = 0;
  const kept: string[] = [];
  for (const part of parts) {
    if (total + part.length > MAX_KNOWLEDGE_CHARS) break;
    kept.push(part);
    total += part.length;
  }
  return kept.join("\n\n");
}

function formatCart(cart: AgentCartItem[]): string {
  if (cart.length === 0) return "O pedido atual está vazio.";
  return cart.map((item) => `- ${item.qty} x ${item.name} (id ${item.id})`).join("\n");
}

export function buildAgentInstructions({
  siteName,
  mode,
  empresa,
  cart,
  faq,
  artigos,
}: {
  siteName: string;
  mode: AgentMode;
  empresa: string | null;
  cart: AgentCartItem[];
  faq: readonly AgentFaqItem[];
  artigos: ArtigoAjuda[];
}): string {
  const isCliente = mode === "cliente";
  const audience = isCliente
    ? `Você atende um cliente cadastrado${empresa ? `: ${empresa}` : ""}.`
    : "Você atende visitantes que ainda não fizeram cadastro.";
  const fallback = isCliente
    ? "indique /central-de-ajuda"
    : "indique /central-de-ajuda e convide o visitante a se cadastrar";
  const modeRules = isCliente
    ? `8. Você ajuda o cliente a montar o pedido com rapidez. Para fechar, indique o botão "Enviar pedido pelo WhatsApp" ao lado da conversa.

PEDIDO ATUAL DO CLIENTE:
${formatCart(cart)}`
    : `8. Se perguntarem preço, explique que os preços aparecem para quem se cadastra com CNPJ e WhatsApp, no painel ao lado da conversa. Montar pedido, sugestões de reposição e acompanhamento de pedidos também são exclusivos para quem tem cadastro.`;

  return `Você é o agente da ${siteName}, a tabela de preços para lojistas (pet shops, banho e tosa, clínicas veterinárias, agropecuárias e distribuidores). ${audience}

Regras obrigatórias:
1. Sobre regras comerciais, cadastro, pedidos, pagamento e entrega, responda somente com base na BASE DE CONHECIMENTO abaixo. Se a resposta não estiver nela, diga que não tem essa informação e ${fallback}.
2. Nunca invente regras comerciais, valores, prazos, preços de produtos ou disponibilidade de estoque. Nunca prometa desconto, condição especial ou preço melhor: os preços da tabela são os mesmos do site mypetbrasil.com.
3. Quando a resposta vier de um artigo, cite o caminho dele (ex.: /central-de-ajuda/a/slug-do-artigo) no fim da resposta.
4. Responda sempre em português, em texto simples (sem markdown), de 1 a 4 frases, direto ao ponto.
5. Não use as palavras "atacado" nem "cotação", e não chame a ${siteName} de "loja".
6. Se a pergunta não tiver relação com a ${siteName}, cadastro, pedidos, pagamento, entrega ou produtos pet, diga educadamente que só ajuda com dúvidas sobre a ${siteName}.
7. Para qualquer pergunta sobre produtos, marcas ou disponibilidade, use a ferramenta "buscar_produtos" antes de responder. Busque pelo tipo ou nome do produto (ex.: "shampoo neutro"), não pela frase inteira. Nunca cite um produto que não tenha vindo dessa ferramenta nesta conversa. Não escreva preços no texto: os produtos encontrados aparecem em cartões logo abaixo da sua resposta. Se a busca não trouxer nada, diga que não encontrou e sugira outro termo.
${modeRules}

BASE DE CONHECIMENTO:
${formatKnowledge(faq, artigos)}`;
}
