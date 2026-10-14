import type { NextRequest } from "next/server";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  validateUIMessages,
  type ToolSet,
  type UIMessage,
} from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAssistantModelChain } from "./ai-provider";
import { consumeAiQuota, hashClientIp } from "./ai-usage-limits";
import { buildCatalogTool } from "./agent-catalog-tool";
import { ensureConversation, loadHistory, saveTurn, type ConversationAccess } from "./agent-conversations";
import { buildAgentInstructions, type AgentFaqItem, type AgentMode } from "./agent-prompt";
import { parseAgentRequest } from "./agent-request";
import { openStreamWithFallback } from "./agent-stream";
import { getArtigosAjudaPublicados } from "./help-center";
import { rejectForeignRequest } from "./request-guards";
import { getHubServiceClient } from "./supabase";

// Agente /agente: um agente com dois modos. O modo vem só do cookie (via
// resolveBuyer); o histórico vem do banco; o navegador manda só a pergunta nova.

export type AgentBuyer = { id: string; empresa: string | null };

export type AgentConfig = {
  channel: string;
  siteName: string;
  faq: readonly AgentFaqItem[];
  resolveBuyer: (req: NextRequest) => Promise<AgentBuyer | null>;
};

const AGENT_TIMEOUT_MS = 45_000;
const MAX_STEPS = 5;
const MAX_REPLY_TOKENS = 600;
const UNAVAILABLE_MESSAGE = "Não foi possível responder agora. Tente novamente em instantes.";

function errorResponse(status: number, code: string, message: string): Response {
  return Response.json({ ok: false, error: { code, message } }, { status });
}

async function safeResolveBuyer(config: AgentConfig, req: NextRequest): Promise<AgentBuyer | null> {
  try {
    return await config.resolveBuyer(req);
  } catch (error) {
    console.error("[agent] falha ao identificar comprador:", error);
    return null;
  }
}

async function validateHistory(messages: UIMessage[], tools: ToolSet): Promise<UIMessage[]> {
  try {
    return await validateUIMessages({ messages, tools: tools as Parameters<typeof validateUIMessages>[0]["tools"] });
  } catch (error) {
    console.error("[agent] histórico inválido, seguindo só com a pergunta atual:", error);
    return messages.slice(-1);
  }
}

// Só grava o turno quando a resposta terminou bem e tem texto: respostas
// abortadas, com erro ou vazias deixariam no histórico uma mensagem inválida.
export function shouldSaveTurn({
  isAborted,
  finishReason,
  responseMessage,
}: {
  isAborted: boolean;
  finishReason?: string;
  responseMessage: UIMessage;
}): boolean {
  if (isAborted || finishReason == null || finishReason === "error") return false;
  return responseMessage.parts.some((part) => part.type === "text" && part.text.trim().length > 0);
}

export function createAgentHandler(config: AgentConfig) {
  return async function POST(req: NextRequest): Promise<Response> {
    const foreign = rejectForeignRequest(req);
    if (foreign) return foreign;

    const parsed = parseAgentRequest(await req.json().catch(() => null));
    if (!parsed.ok) return errorResponse(400, "INVALID_INPUT", parsed.message);
    const { id, message, cart } = parsed.value;

    const buyer = await safeResolveBuyer(config, req);
    const mode: AgentMode = buyer ? "cliente" : "visitante";

    const limited = buyer
      ? await consumeAiQuota("agente_cliente", config.channel, req.headers, buyer.id)
      : await consumeAiQuota("duvidas", config.channel, req.headers);
    if (limited) return limited;

    let supabase: SupabaseClient | null = null;
    let access: ConversationAccess = "unavailable";
    try {
      supabase = getHubServiceClient();
      access = await ensureConversation(supabase, {
        id,
        channel: config.channel,
        buyerId: buyer?.id ?? null,
        ipHash: hashClientIp(req.headers),
        mode,
      });
    } catch (error) {
      console.error("[agent] Supabase indisponível:", error);
    }
    if (access === "forbidden") {
      return errorResponse(403, "CONVERSATION_FORBIDDEN", "Esta conversa não está disponível. Comece uma nova.");
    }
    const store = access === "ok" ? supabase : null;

    const tools = { buscar_produtos: buildCatalogTool({ channel: config.channel, showPrices: mode === "cliente" }) };
    const history = store ? await loadHistory(store, id) : [];
    const messages = await validateHistory([...history, message], tools);
    const artigos = await getArtigosAjudaPublicados();
    const instructions = buildAgentInstructions({
      siteName: config.siteName,
      mode,
      empresa: buyer?.empresa ?? null,
      cart: mode === "cliente" ? cart : [],
      faq: config.faq,
      artigos,
    });
    const modelMessages = await convertToModelMessages(messages, { tools, ignoreIncompleteToolCalls: true });

    const stream = await openStreamWithFallback(
      getAssistantModelChain().map((candidate) => ({
        provider: candidate.provider,
        open: () =>
          streamText({
            model: candidate.model,
            instructions,
            messages: modelMessages,
            tools,
            stopWhen: isStepCount(MAX_STEPS),
            maxOutputTokens: MAX_REPLY_TOKENS,
            maxRetries: 1,
            abortSignal: AbortSignal.timeout(AGENT_TIMEOUT_MS),
            onError: ({ error }) => console.error(`[agent] erro no provedor "${candidate.provider}":`, error),
          }).stream,
      })),
    );
    if (!stream) return errorResponse(502, "AI_PROVIDER_ERROR", UNAVAILABLE_MESSAGE);

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({
        stream,
        tools,
        originalMessages: messages,
        generateMessageId: () => crypto.randomUUID(),
        onError: () => UNAVAILABLE_MESSAGE,
        onEnd: async ({ isAborted, finishReason, responseMessage }) => {
          if (!store) return;
          if (!shouldSaveTurn({ isAborted, finishReason, responseMessage })) return;
          await saveTurn(store, { conversationId: id, mode, messages: [message, responseMessage] });
        },
      }),
    });
  };
}
