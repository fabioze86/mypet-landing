import type { NextRequest } from "next/server";
import { generateText } from "ai";
import { getAssistantModelChain } from "./ai-provider";
import { parseAssistantRequest } from "./assistant-server";
import { getArtigosAjudaPublicados, type ArtigoAjuda } from "./help-center";
import { rejectForeignRequest } from "./request-guards";

// Assistente de dúvidas da landing pública (sem login): responde só com base no
// FAQ comercial do site e nos artigos publicados da Central de Ajuda. Não usa
// ferramentas nem acessa catálogo/preço.

export type SupportFaqItem = { readonly q: string; readonly a: string };

export type SupportAssistantConfig = {
  channel: string;
  siteName: string;
  faq: readonly SupportFaqItem[];
};

const MAX_ARTICLE_CHARS = 4000;
const MAX_KNOWLEDGE_CHARS = 60000;
const MAX_REPLY_TOKENS = 500;

function formatKnowledge(faq: readonly SupportFaqItem[], artigos: ArtigoAjuda[]): string {
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

export function buildSupportSystemPrompt(
  siteName: string,
  faq: readonly SupportFaqItem[],
  artigos: ArtigoAjuda[],
): string {
  return `Você é o assistente de dúvidas da ${siteName}, a tabela de preços para lojistas (pet shops, banho e tosa, clínicas veterinárias, agropecuárias e distribuidores). Você atende visitantes que ainda não fizeram cadastro.

Regras obrigatórias:
1. Responda somente com base na BASE DE CONHECIMENTO abaixo. Se a resposta não estiver nela, diga que não tem essa informação e oriente o visitante a fazer o cadastro em /cadastro e falar com o time pelo WhatsApp, ou consultar /central-de-ajuda.
2. Nunca invente regras comerciais, valores, prazos, preços de produtos ou disponibilidade de estoque. Preço de produto só aparece na tabela, depois do cadastro em /cadastro.
3. Quando a resposta vier de um artigo, cite o caminho dele (ex.: /central-de-ajuda/a/slug-do-artigo) no fim da resposta.
4. Responda sempre em português, em texto simples (sem markdown), de 1 a 4 frases, direto ao ponto.
5. Não use as palavras "atacado" nem "cotação". Os preços da tabela são os mesmos do site mypetbrasil.com.
6. Se a pergunta não tiver relação com a ${siteName}, cadastro, pedidos, pagamento, entrega ou produtos pet, diga educadamente que só ajuda com dúvidas sobre a ${siteName}.

BASE DE CONHECIMENTO:
${formatKnowledge(faq, artigos)}`;
}

export function createSupportAssistantHandler(config: SupportAssistantConfig) {
  return async function POST(req: NextRequest) {
    const foreign = rejectForeignRequest(req);
    if (foreign) return foreign;

    const body = await req.json().catch(() => null);
    const parsed = parseAssistantRequest(body);

    if (!parsed.ok) {
      return Response.json(
        { ok: false, error: { code: "INVALID_INPUT", message: parsed.message } },
        { status: 400 },
      );
    }

    if (parsed.value.channel !== config.channel) {
      return Response.json(
        { ok: false, error: { code: "CHANNEL_MISMATCH", message: "Canal não corresponde a este site." } },
        { status: 403 },
      );
    }

    const artigos = await getArtigosAjudaPublicados();
    const system = buildSupportSystemPrompt(config.siteName, config.faq, artigos);

    for (const candidate of getAssistantModelChain()) {
      try {
        const result = await generateText({
          model: candidate.model,
          system,
          messages: parsed.value.messages,
          maxOutputTokens: MAX_REPLY_TOKENS,
        });
        return Response.json({ ok: true, reply: result.text });
      } catch (error) {
        console.error(`[support-assistant] erro no provedor "${candidate.provider}":`, error);
      }
    }

    return Response.json(
      {
        ok: false,
        error: {
          code: "AI_PROVIDER_ERROR",
          message: "Não foi possível responder agora. Tente novamente em instantes.",
        },
      },
      { status: 502 },
    );
  };
}
