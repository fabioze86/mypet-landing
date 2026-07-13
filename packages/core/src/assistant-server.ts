import { NextRequest } from "next/server";
import { generateText, tool, stepCountIs } from "ai";
import { z } from "zod";
import { getCatalog, getCategories, type CategoryNode } from "./catalog";
import { getAssistantModelChain, isAssistantProvider, isSelectableModel, type AssistantModelOverride } from "./ai-provider";
import type { CatalogProduct } from "./catalog-utils";

export type AssistantMessage = { role: "user" | "assistant"; content: string };

const MAX_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 2000;

type ProfileGuess = {
  perfil: "pet_shop" | "banho_tosa" | "outro";
  confianca: "alta" | "baixa";
  opcoes?: string[];
};

type ParsedAssistantRequest = {
  channel: string;
  messages: AssistantMessage[];
  modelOverride?: AssistantModelOverride;
  adminKey?: string;
};

export function parseAssistantRequest(
  body: unknown,
): { ok: true; value: ParsedAssistantRequest } | { ok: false; message: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, message: "Corpo da requisição inválido." };
  }
  const { channel, messages, provider, model, adminKey } = body as Record<string, unknown>;

  if (typeof channel !== "string" || !channel.trim()) {
    return { ok: false, message: "Canal não informado." };
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return { ok: false, message: "Nenhuma mensagem informada." };
  }
  if (messages.length > MAX_MESSAGES) {
    return { ok: false, message: "Conversa muito longa. Recarregue a página para recomeçar." };
  }

  const parsedMessages: AssistantMessage[] = [];
  for (const raw of messages) {
    if (!raw || typeof raw !== "object") {
      return { ok: false, message: "Mensagem inválida." };
    }
    const { role, content } = raw as Record<string, unknown>;
    if (role !== "user" && role !== "assistant") {
      return { ok: false, message: "Papel de mensagem inválido." };
    }
    if (typeof content !== "string" || !content.trim()) {
      return { ok: false, message: "Mensagem vazia." };
    }
    if (content.length > MAX_MESSAGE_LENGTH) {
      return { ok: false, message: "Mensagem muito longa. Tente ser mais direto." };
    }
    parsedMessages.push({ role, content });
  }

  let modelOverride: AssistantModelOverride | undefined;
  if (provider !== undefined || model !== undefined) {
    if (typeof provider !== "string" || !isAssistantProvider(provider)) {
      return { ok: false, message: "Provedor de IA inválido." };
    }
    if (typeof model !== "string" || !isSelectableModel(provider, model)) {
      return { ok: false, message: "Modelo de IA inválido para este provedor." };
    }
    modelOverride = { provider, model };
  }

  return {
    ok: true,
    value: {
      channel,
      messages: parsedMessages,
      modelOverride,
      adminKey: typeof adminKey === "string" ? adminKey : undefined,
    },
  };
}

function collectCategorySubtreeIds(categories: CategoryNode[], rootId: string): string[] {
  const childrenByParent = new Map<string, string[]>();
  for (const c of categories) {
    if (!c.parentId) continue;
    const siblings = childrenByParent.get(c.parentId) ?? [];
    siblings.push(c.id);
    childrenByParent.set(c.parentId, siblings);
  }
  const ids: string[] = [];
  const visit = (id: string) => {
    ids.push(id);
    for (const childId of childrenByParent.get(id) ?? []) visit(childId);
  };
  visit(rootId);
  return ids;
}

function formatCategories(categories: CategoryNode[]): string {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const pathFor = (c: CategoryNode): string => {
    const parent = c.parentId ? byId.get(c.parentId) : undefined;
    return parent ? `${pathFor(parent)} > ${c.name}` : c.name;
  };
  return categories.map((c) => `${c.slug}: ${pathFor(c)}`).join("\n");
}

function buildSystemPrompt(categories: CategoryNode[]): string {
  return `Você é o assistente de compras de um atacado B2B para pet shops. Seu trabalho é entender o que o visitante precisa, identificar se ele é (a) um pet shop querendo montar ou repor estoque para revenda, ou (b) um banho-e-tosa/estética animal que consome os produtos no próprio negócio, e recomendar produtos reais do catálogo.

Regras obrigatórias:
1. Nunca cite ou recomende um produto que não tenha vindo de uma chamada à ferramenta "buscar_produtos" nesta conversa. Se ainda não buscou nada relevante para a pergunta atual, use a ferramenta antes de responder. A busca por categoria já inclui automaticamente todas as subcategorias: pode usar uma categoria de nível mais alto (ex.: "banho-tosa") sem precisar acertar a subcategoria exata. Prefira usar "query" com o tipo de produto (ex.: "shampoo") em vez de frases do perfil do visitante (ex.: não busque por "banho e tosa").
2. Assim que tiver uma opinião sobre o perfil do visitante (mesmo que tentativa), chame a ferramenta "registrar_perfil" com sua conclusão.
3. Se não tiver confiança suficiente sobre o perfil, registre confianca "baixa" e inclua de 2 a 3 opções curtas em "opcoes" para o visitante escolher (ex.: "Sou pet shop", "Sou banho e tosa", "Só estou pesquisando").
4. Categorias com "(PRO)" no nome são de uso profissional em banho e tosa. A categoria "Montagem de Loja" costuma indicar pet shop novo.
5. Responda sempre em português, em 1 a 3 frases, direto ao ponto.
6. Antes de terminar, se sua resposta menciona ou recomenda produtos, chame a ferramenta "recomendar_produtos" com os IDs exatos (só os que vieram de "buscar_produtos" nesta conversa) que devem aparecer para o visitante, na ordem de relevância. Não chame essa ferramenta se você não estiver recomendando nenhum produto específico.

Árvore de categorias do catálogo (formato "slug: caminho completo"):
${formatCategories(categories)}`;
}

type BuildToolsOptions = {
  channel: string;
  categories: CategoryNode[];
  foundProducts: Map<string, CatalogProduct>;
  profileState: { guess: ProfileGuess | null };
  selectionState: { ids: string[] | null };
};

export function buildAssistantTools({
  channel,
  categories,
  foundProducts,
  profileState,
  selectionState,
}: BuildToolsOptions) {
  const categoryIdBySlug = new Map(categories.map((c) => [c.slug, c.id]));

  return {
    buscar_produtos: tool({
      description:
        "Busca produtos reais do catálogo por texto livre e/ou categoria. Use antes de recomendar qualquer produto.",
      inputSchema: z.object({
        query: z.string().optional().describe("Termo de busca livre, ex: 'shampoo', 'ração filhote'"),
        categorySlug: z
          .string()
          .optional()
          .describe("Slug de uma categoria da árvore recebida no início da conversa"),
        brand: z.string().optional().describe("Marca exata do produto, se mencionada"),
      }),
      execute: async ({ query, categorySlug, brand }) => {
        const categoryId = categorySlug ? categoryIdBySlug.get(categorySlug) : undefined;
        const categoryIds = categoryId ? collectCategorySubtreeIds(categories, categoryId) : undefined;
        const result = await getCatalog({ q: query, brand, categoryId: categoryIds, page: 1, channel });
        for (const item of result.items) {
          foundProducts.set(item.id, item);
        }
        return {
          total: result.total,
          produtos: result.items.map((p) => ({
            id: p.id,
            nome: p.name,
            marca: p.brand,
            categoria: p.category?.name ?? null,
          })),
        };
      },
    }),
    registrar_perfil: tool({
      description:
        "Registra sua conclusão sobre o perfil do visitante (pet_shop, banho_tosa ou outro) e o nível de confiança.",
      inputSchema: z.object({
        perfil: z.enum(["pet_shop", "banho_tosa", "outro"]),
        confianca: z.enum(["alta", "baixa"]),
        opcoes: z
          .array(z.string())
          .max(3)
          .optional()
          .describe('Só quando confianca = "baixa": rótulos curtos para o visitante escolher'),
      }),
      execute: async (input) => {
        profileState.guess = input;
        return { registrado: true };
      },
    }),
    recomendar_produtos: tool({
      description:
        "Define quais produtos (dentre os já encontrados por buscar_produtos) devem aparecer para o visitante, na ordem de relevância.",
      inputSchema: z.object({
        productIds: z
          .array(z.string())
          .min(1)
          .max(8)
          .describe("IDs de produtos retornados por buscar_produtos nesta conversa, do mais para o menos relevante"),
      }),
      execute: async ({ productIds }) => {
        selectionState.ids = productIds;
        return { registrado: true };
      },
    }),
  };
}

export function createAssistantHandler(expectedChannel: string) {
  return async function POST(req: NextRequest) {
    const body = await req.json().catch(() => null);
    const parsed = parseAssistantRequest(body);

    if (!parsed.ok) {
      return Response.json(
        { ok: false, error: { code: "INVALID_INPUT", message: parsed.message } },
        { status: 400 },
      );
    }

    if (parsed.value.channel !== expectedChannel) {
      return Response.json(
        { ok: false, error: { code: "CHANNEL_MISMATCH", message: "Canal não corresponde a este site." } },
        { status: 403 },
      );
    }

    const adminKeyEnv = process.env.ADMIN_AI_OVERRIDE_KEY;
    const override =
      adminKeyEnv && parsed.value.adminKey === adminKeyEnv ? parsed.value.modelOverride : undefined;

    return handleAssistantRequest(parsed.value, override);
  };
}

async function handleAssistantRequest(
  { channel, messages }: ParsedAssistantRequest,
  override?: AssistantModelOverride,
) {
  const categories = await getCategories();
  const foundProducts = new Map<string, CatalogProduct>();
  const profileState: { guess: ProfileGuess | null } = { guess: null };
  const selectionState: { ids: string[] | null } = { ids: null };
  const tools = buildAssistantTools({ channel, categories, foundProducts, profileState, selectionState });

  let result: { text: string } | undefined;
  let usedProvider: string | undefined;
  for (const candidate of getAssistantModelChain(override)) {
    try {
      result = await generateText({
        model: candidate.model,
        system: buildSystemPrompt(categories),
        messages,
        tools,
        stopWhen: stepCountIs(5),
      });
      usedProvider = candidate.provider;
      break;
    } catch (error) {
      console.error(`[assistant] erro no provedor "${candidate.provider}":`, error);
    }
  }

  if (!result) {
    return Response.json(
      {
        ok: false,
        error: {
          code: "AI_PROVIDER_ERROR",
          message: "Não foi possível processar sua mensagem agora. Tente novamente.",
        },
      },
      { status: 502 },
    );
  }

  const selectedProducts = (selectionState.ids ?? [])
    .map((id) => foundProducts.get(id))
    .filter((p): p is CatalogProduct => Boolean(p));

  const response: {
    ok: true;
    reply: string;
    products: CatalogProduct[];
    profileGuess?: { label: ProfileGuess["perfil"]; confidence: ProfileGuess["confianca"] };
    profileOptions?: { label: string; value: string }[];
    usedProvider?: string;
  } = {
    ok: true,
    reply: result.text,
    products: selectedProducts.length > 0 ? selectedProducts.slice(0, 8) : [...foundProducts.values()].slice(0, 8),
    usedProvider,
  };

  if (profileState.guess) {
    response.profileGuess = { label: profileState.guess.perfil, confidence: profileState.guess.confianca };
    if (profileState.guess.confianca === "baixa" && profileState.guess.opcoes?.length) {
      response.profileOptions = profileState.guess.opcoes.map((label) => ({ label, value: label }));
    }
  }

  return Response.json(response);
}
