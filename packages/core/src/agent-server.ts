import type { NextRequest } from "next/server";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  validateUIMessages,
  type LanguageModel,
  type LanguageModelUsage,
  type ToolSet,
  type UIMessage,
} from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAssistantModelChain } from "./ai-provider";
import { checkAiQuota, hashClientIp } from "./ai-usage-limits";
import { buildCatalogTool } from "./agent-catalog-tool";
import { buildCustomerTools } from "./agent-customer-tools";
import {
  ensureConversation,
  loadHistory,
  messageText,
  saveTurn,
  type ConversationAccess,
} from "./agent-conversations";
import { recordAgentEvent, shouldRecordQuotaBlock, summarizeError, type AgentEvent, type AgentEventContext } from "./agent-events";
import { buildAgentInstructions, type AgentFaqItem, type AgentMode } from "./agent-prompt";
import { parseAgentRequest } from "./agent-request";
import { openStreamWithFallback } from "./agent-stream";
import { getArtigosAjudaPublicados } from "./help-center";
import { rejectForeignRequest } from "./request-guards";
import { getHubServiceClient } from "./supabase";

// Agente /agente: um agente com dois modos. O modo vem só do cookie (via
// resolveBuyer); o histórico vem do banco; o navegador manda só a pergunta nova.
// Telemetria: métricas da resposta em agent_messages e o resto em agent_events
// (agent-events.ts). Nada disso muda o que o usuário recebe.

export type AgentBuyer = { id: string; empresa: string | null };

export type AgentConfig = {
  channel: string;
  siteName: string;
  faq: readonly AgentFaqItem[];
  resolveBuyer: (req: NextRequest) => Promise<AgentBuyer | null>;
};

const AGENT_TIMEOUT = { totalMs: 45_000, chunkMs: 15_000 };
const MAX_STEPS = 5;
const MAX_REPLY_TOKENS = 600;
// Quanto esperar pelo uso de tokens no fim da resposta antes de gravar sem ele.
const USAGE_WAIT_MS = 2_000;
const UNAVAILABLE_MESSAGE = "Não foi possível responder agora. Tente novamente em instantes.";

// Só o necessário do resultado do streamText. Os getters são preguiçosos: ler
// totalUsage de um provedor que falhou criaria uma promessa rejeitada sem dono.
type UsageSource = { totalUsage: PromiseLike<LanguageModelUsage>; steps: PromiseLike<unknown[]> };

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

// Valor de uma promessa com limite de tempo; null se não vier a tempo ou falhar.
async function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), ms);
      }),
    ]);
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function modelIdOf(model: LanguageModel): string | null {
  return typeof model === "string" ? model : (model as { modelId?: string }).modelId ?? null;
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

// Evento de um turno que não foi gravado. Sem finishReason é desconexão: o AI
// SDK chama onEnd pelo cancel do stream, sem a parte "abort".
export function failedTurnEvent({ isAborted, finishReason }: { isAborted: boolean; finishReason?: string }): AgentEvent {
  if (isAborted || finishReason == null) return { kind: "aborted" };
  if (finishReason === "error") return { kind: "provider_error", detail: { finish_reason: finishReason } };
  return { kind: "empty_reply", detail: { finish_reason: finishReason } };
}

export function createAgentHandler(config: AgentConfig) {
  return async function POST(req: NextRequest): Promise<Response> {
    const t0 = Date.now();
    const foreign = rejectForeignRequest(req);
    if (foreign) return foreign;

    const parsed = parseAgentRequest(await req.json().catch(() => null));
    if (!parsed.ok) return errorResponse(400, "INVALID_INPUT", parsed.message);
    const { id, message, cart } = parsed.value;

    const buyer = await safeResolveBuyer(config, req);
    const mode: AgentMode = buyer ? "cliente" : "visitante";
    const ipHash = hashClientIp(req.headers);

    let supabase: SupabaseClient | null = null;
    try {
      supabase = getHubServiceClient();
    } catch (error) {
      console.error("[agent] Supabase indisponível:", error);
    }

    const eventContext: AgentEventContext = {
      conversationId: id,
      channel: config.channel,
      mode,
      buyerId: buyer?.id ?? null,
      ipHash,
      question: messageText(message),
    };
    // recordAgentEvent já não lança; o catch aqui garante que nenhuma falha de
    // telemetria chegue à resposta.
    const logEvent = (event: AgentEvent): Promise<void> =>
      recordAgentEvent(supabase, eventContext, event).catch((error) => {
        console.error("[agent-events] falha inesperada:", error);
      });

    const blocked = buyer
      ? await checkAiQuota("agente_cliente", config.channel, req.headers, buyer.id)
      : await checkAiQuota("duvidas", config.channel, req.headers);
    if (blocked) {
      // Só o primeiro bloqueio do sujeito na janela vira linha; a checagem não
      // muda a resposta, mesmo se falhar.
      const record = await shouldRecordQuotaBlock(supabase, eventContext, blocked.reason).catch(() => true);
      if (record) await logEvent({ kind: "quota_blocked", detail: { reason: blocked.reason } });
      return blocked.response;
    }

    const access: ConversationAccess = supabase
      ? await ensureConversation(supabase, { id, channel: config.channel, buyerId: buyer?.id ?? null, ipHash, mode })
      : "unavailable";
    if (access === "forbidden") {
      await logEvent({ kind: "conversation_forbidden" });
      return errorResponse(403, "CONVERSATION_FORBIDDEN", "Esta conversa não está disponível. Comece uma nova.");
    }
    const store = access === "ok" ? supabase : null;

    const catalogTool = buildCatalogTool({ channel: config.channel, showPrices: mode === "cliente" });
    // Visitante não recebe as ferramentas de pedido; o comprador delas é o do cookie.
    const tools: ToolSet = buyer
      ? { buscar_produtos: catalogTool, ...buildCustomerTools({ channel: config.channel, buyerId: buyer.id }) }
      : { buscar_produtos: catalogTool };
    const history = store
      ? await loadHistory(store, id, mode === "visitante" ? { onlyMode: "visitante" } : {})
      : [];
    // Cada envio do navegador usa um id novo; id repetido (reenvio ou id de uma
    // resposta) deixaria o histórico inconsistente.
    if (history.some((item) => item.id === message.id)) {
      await logEvent({ kind: "duplicate_message", detail: { message_id: message.id } });
      return errorResponse(409, "MESSAGE_DUPLICATE", "Esta mensagem já foi enviada. Comece uma nova conversa.");
    }
    const messages = await validateHistory([...history, message], tools);

    let instructions: string;
    let modelMessages: Awaited<ReturnType<typeof convertToModelMessages>>;
    let chain: ReturnType<typeof getAssistantModelChain>;
    try {
      const artigos = await getArtigosAjudaPublicados();
      instructions = buildAgentInstructions({
        siteName: config.siteName,
        mode,
        empresa: buyer?.empresa ?? null,
        cart: mode === "cliente" ? cart : [],
        faq: config.faq,
        artigos,
      });
      modelMessages = await convertToModelMessages(messages, { tools, ignoreIncompleteToolCalls: true });
      chain = getAssistantModelChain();
    } catch (error) {
      console.error("[agent] falha ao preparar a chamada ao modelo:", error);
      await logEvent({
        kind: "provider_error",
        detail: { failures: [{ provider: "config", error: summarizeError(error) }] },
      });
      return errorResponse(502, "AI_PROVIDER_ERROR", UNAVAILABLE_MESSAGE);
    }

    // Sem await: o "aguardando resposta" do dashboard precisa do evento já no
    // envio. As gravações pendentes são aguardadas no fim (onEnd ou 502), para
    // a função não terminar com o insert no meio.
    const pending: Promise<void>[] = [logEvent({ kind: "turn_started", detail: { message_id: message.id } })];

    const results: UsageSource[] = [];
    const opened = await openStreamWithFallback(
      chain.map((candidate, index) => ({
        provider: candidate.provider,
        open: () => {
          const result = streamText({
            model: candidate.model,
            instructions,
            messages: modelMessages,
            tools,
            stopWhen: isStepCount(MAX_STEPS),
            maxOutputTokens: MAX_REPLY_TOKENS,
            maxRetries: 1,
            // chunkMs: provedor que para de mandar trechos aborta e, antes do
            // primeiro conteúdo, cai no próximo provedor (agent-stream.ts).
            timeout: AGENT_TIMEOUT,
            // Cliente desconectou: para a chamada ao provedor.
            abortSignal: req.signal,
            // As conversas ficam no Supabase; nada guardado do lado da OpenAI.
            providerOptions: { openai: { store: false } },
            onError: ({ error }) => console.error(`[agent] erro no provedor "${candidate.provider}":`, error),
          });
          results[index] = result;
          return result.stream;
        },
      })),
    );
    const firstTokenMs = Date.now() - t0;
    const failures = opened.failures.map((failure) => ({
      provider: failure.provider,
      error: summarizeError(failure.error),
    }));

    if (!opened.stream) {
      pending.push(logEvent({ kind: "provider_error", detail: { failures } }));
      await Promise.all(pending);
      return errorResponse(502, "AI_PROVIDER_ERROR", UNAVAILABLE_MESSAGE);
    }

    const winner = chain[opened.index];
    for (const failure of failures) {
      pending.push(
        logEvent({
          kind: "provider_fallback",
          provider: winner.provider,
          detail: { failed_provider: failure.provider, error: failure.error },
        }),
      );
    }

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({
        stream: opened.stream,
        tools,
        originalMessages: messages,
        generateMessageId: () => crypto.randomUUID(),
        onError: () => UNAVAILABLE_MESSAGE,
        onEnd: async ({ isAborted, finishReason, responseMessage }) => {
          const latencyMs = Date.now() - t0;
          // finally: um erro aqui não pode pular o await das gravações pendentes.
          try {
            if (!shouldSaveTurn({ isAborted, finishReason, responseMessage })) {
              pending.push(logEvent({ ...failedTurnEvent({ isAborted, finishReason }), provider: winner.provider, latencyMs }));
            } else if (store) {
              const source = results[opened.index];
              const [usage, steps] = await Promise.all([
                withTimeout(source.totalUsage, USAGE_WAIT_MS),
                withTimeout(source.steps, USAGE_WAIT_MS),
              ]);
              await saveTurn(store, {
                conversationId: id,
                mode,
                messages: [message, responseMessage],
                metrics: {
                  provider: winner.provider,
                  model: modelIdOf(winner.model),
                  latencyMs,
                  firstTokenMs,
                  inputTokens: usage?.inputTokens ?? null,
                  outputTokens: usage?.outputTokens ?? null,
                  steps: steps?.length ?? null,
                },
              });
            }
          } finally {
            await Promise.all(pending);
          }
        },
      }),
    });
  };
}
