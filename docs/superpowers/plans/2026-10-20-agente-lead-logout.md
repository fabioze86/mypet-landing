# Agente: nome/WhatsApp do visitante, logout do cliente e exemplos sem ração — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O visitante do /agente informa nome e WhatsApp num roteiro fixo antes da primeira pergunta; o cliente logado vê "Olá, [nome]" e pode sair; o agente para de citar ração.

**Architecture:** Validação do lead num módulo puro (`agent-lead.ts`) usado pelo navegador e pelo servidor. O navegador guarda o lead em `localStorage` e o manda em cada POST a `/api/agente`; o servidor grava em colunas novas de `agent_conversations` e põe o nome no prompt. Logout é uma rota `POST /api/sair` que expira o cookie `mypet_acesso`.

**Tech Stack:** Next.js (app router, ler `node_modules/next/dist/docs/` antes de criar rota), React 19, AI SDK (`ai`, `@ai-sdk/react`), Supabase, Vitest + Testing Library, pnpm workspaces.

Spec: `docs/superpowers/specs/2026-10-20-agente-lead-logout-design.md`

## Global Constraints

- Português em textos, comentários e mensagens de commit; comentários no estilo do código vizinho (curtos, explicam o porquê).
- Copy do roteiro, exata: `Antes de prosseguir, preciso de duas informações: 1 - Qual é o seu nome?` e `2 - Deseja informar um WhatsApp?`.
- Saudação: visitante que acabou de responder → `Obrigado, [nome]! Como posso te ajudar hoje?`; visitante com lead salvo → `Olá, [nome]! Como posso te ajudar hoje?`; cliente → `Olá, [nome]! Como posso te ajudar hoje?` (sem nome: `Como posso te ajudar hoje?`).
- Cabeçalho do cliente: `Olá, [nome]` (sem nome: `Olá!`) e botão `Sair`. Erro do Sair: `Não foi possível sair agora. Tente de novo.`
- Nome: 1 a 80 caracteres; WhatsApp: 1 a 40 caracteres; ambos numa linha só (espaços colapsados) e cortados no limite. WhatsApp grava o texto digitado, inclusive "não".
- Chave do `localStorage`: `mypet_agente_lead`.
- Proibido na copy: "atacado", "cotação", chamar a My Pet Brasil de "loja".
- Lead só vale no modo `visitante`; no modo `cliente` é ignorado.
- Falha ao gravar o lead nunca derruba a resposta do agente.
- Desvio consciente do spec: o lead é gravado por uma função própria (`saveConversationLead`) chamada logo depois de `ensureConversation`, em vez de dentro dela. Mesmo efeito (preenche só se `lead_nome` ainda for nulo), sem mexer nos testes de posse da conversa.
- Comandos de teste: `pnpm --filter @mypet/core exec vitest run <arquivos>` e `pnpm --filter mypet exec vitest run <arquivos>`. Typecheck: `pnpm --filter <pacote> exec tsc --noEmit`.
- Commits na `main` (sem worktree). Cada commit termina com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Não incluir arquivos alheios (há alterações pendentes em `apps/zemann`): usar sempre `git add <arquivos>` explícito.

---

### Task 1: Validação do lead e aceite no pedido do agente

**Files:**
- Create: `packages/core/src/agent-lead.ts`
- Create: `packages/core/src/agent-lead.test.ts`
- Modify: `packages/core/src/agent-request.ts`
- Test: `packages/core/src/agent-request.test.ts`

**Interfaces:**
- Produces: `type AgentLead = { nome: string; whatsapp: string }`, `LEAD_NAME_MAX = 80`, `LEAD_WHATSAPP_MAX = 40`, `normalizeAgentLead(raw: unknown): AgentLead | null` em `./agent-lead`. `ParsedAgentRequest` ganha `lead?: AgentLead`.

- [ ] **Step 1: Testes do `normalizeAgentLead`**

Criar `packages/core/src/agent-lead.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { LEAD_NAME_MAX, LEAD_WHATSAPP_MAX, normalizeAgentLead } from "./agent-lead";

describe("normalizeAgentLead", () => {
  it("aceita nome e WhatsApp, numa linha e sem espaços nas pontas", () => {
    expect(normalizeAgentLead({ nome: "  Ana \n Souza ", whatsapp: " (11) 99999-0000 " })).toEqual({
      nome: "Ana Souza",
      whatsapp: "(11) 99999-0000",
    });
  });

  it("aceita \"não\" como resposta do WhatsApp", () => {
    expect(normalizeAgentLead({ nome: "Ana", whatsapp: "não" })).toEqual({ nome: "Ana", whatsapp: "não" });
  });

  it("corta nos limites", () => {
    const lead = normalizeAgentLead({ nome: "a".repeat(200), whatsapp: "9".repeat(200) });
    expect(lead?.nome).toHaveLength(LEAD_NAME_MAX);
    expect(lead?.whatsapp).toHaveLength(LEAD_WHATSAPP_MAX);
  });

  it("recusa vazio, tipo errado ou ausente", () => {
    expect(normalizeAgentLead({ nome: "   ", whatsapp: "não" })).toBeNull();
    expect(normalizeAgentLead({ nome: "Ana", whatsapp: "" })).toBeNull();
    expect(normalizeAgentLead({ nome: 1, whatsapp: "não" })).toBeNull();
    expect(normalizeAgentLead(null)).toBeNull();
    expect(normalizeAgentLead("Ana")).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @mypet/core exec vitest run src/agent-lead.test.ts`
Expected: FAIL (módulo `./agent-lead` não existe).

- [ ] **Step 3: Implementar `agent-lead.ts`**

```ts
// Nome e WhatsApp que o visitante informa no roteiro do /agente. Usado pelo
// navegador (antes de gravar no localStorage) e pelo servidor (antes de gravar
// na conversa): os dois aplicam a mesma regra.

export type AgentLead = { nome: string; whatsapp: string };

export const LEAD_NAME_MAX = 80;
export const LEAD_WHATSAPP_MAX = 40;

function oneLine(value: string, max: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, max).trim();
}

export function normalizeAgentLead(raw: unknown): AgentLead | null {
  if (!raw || typeof raw !== "object") return null;
  const { nome, whatsapp } = raw as Record<string, unknown>;
  if (typeof nome !== "string" || typeof whatsapp !== "string") return null;
  const cleanNome = oneLine(nome, LEAD_NAME_MAX);
  const cleanWhatsapp = oneLine(whatsapp, LEAD_WHATSAPP_MAX);
  if (!cleanNome || !cleanWhatsapp) return null;
  return { nome: cleanNome, whatsapp: cleanWhatsapp };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @mypet/core exec vitest run src/agent-lead.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Testes do `lead` em `parseAgentRequest`**

Acrescentar ao fim do `describe("parseAgentRequest", ...)` em `packages/core/src/agent-request.test.ts`:

```ts
  it("lead: válido é normalizado; ausente ou inválido é ignorado sem recusar", () => {
    const valid = parseAgentRequest({ id, message, cart: [], lead: { nome: " Ana ", whatsapp: "não" } });
    expect(valid.ok && valid.value.lead).toEqual({ nome: "Ana", whatsapp: "não" });

    const absent = parseAgentRequest({ id, message, cart: [] });
    expect(absent.ok && absent.value.lead).toBeUndefined();

    const invalid = parseAgentRequest({ id, message, cart: [], lead: { nome: "", whatsapp: 5 } });
    expect(invalid.ok).toBe(true);
    expect(invalid.ok && invalid.value.lead).toBeUndefined();
  });
```

- [ ] **Step 6: Rodar e ver falhar**

Run: `pnpm --filter @mypet/core exec vitest run src/agent-request.test.ts`
Expected: FAIL no teste novo (`lead` sempre `undefined` no caso válido).

- [ ] **Step 7: Implementar em `agent-request.ts`**

No topo, junto aos imports:

```ts
import { normalizeAgentLead, type AgentLead } from "./agent-lead";
```

Trocar o comentário e o tipo:

```ts
// O navegador manda só a pergunta nova, o carrinho e, no visitante, o lead do
// roteiro; o histórico vem do banco. Nada aqui decide modo nem comprador.

export type ParsedAgentRequest = { id: string; message: UIMessage; cart: AgentCartItem[]; lead?: AgentLead };
```

Em `parseAgentRequest`, trocar `const { id, message, cart } = body as Record<string, unknown>;` por:

```ts
  const { id, message, cart, lead: rawLead } = body as Record<string, unknown>;
```

E trocar o `return` final por:

```ts
  // Lead inválido não recusa a pergunta: só deixa de ser gravado.
  const lead = normalizeAgentLead(rawLead);

  return {
    ok: true,
    value: {
      id,
      message: { id: messageId, role: "user", parts: [{ type: "text", text }] },
      cart: cartItems,
      ...(lead ? { lead } : {}),
    },
  };
```

- [ ] **Step 8: Rodar e ver passar**

Run: `pnpm --filter @mypet/core exec vitest run src/agent-request.test.ts src/agent-lead.test.ts`
Expected: PASS (todos, inclusive os antigos com `toEqual`).

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/agent-lead.ts packages/core/src/agent-lead.test.ts packages/core/src/agent-request.ts packages/core/src/agent-request.test.ts
git commit -m "feat(agente): validação do nome e WhatsApp do visitante no pedido ao agente

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Colunas do lead e gravação na conversa

**Files:**
- Create: `supabase/migrations/20261020120000_agent_conversations_lead.sql`
- Modify: `packages/core/src/agent-conversations.ts`
- Test: `packages/core/src/agent-conversations.test.ts`

**Interfaces:**
- Consumes: `AgentLead` de `./agent-lead` (Task 1).
- Produces: `saveConversationLead(supabase: SupabaseClient, conversationId: string, lead: AgentLead): Promise<void>` em `./agent-conversations`. Nunca lança.

- [ ] **Step 1: Migration**

Criar `supabase/migrations/20261020120000_agent_conversations_lead.sql`:

```sql
-- Nome e WhatsApp que o visitante informa no roteiro do /agente antes da
-- primeira pergunta. lead_whatsapp guarda o texto digitado, inclusive "não".
-- Acesso continua só pelo service role (e leitura do admin pelas políticas já
-- existentes em agent_conversations).

alter table public.agent_conversations
  add column if not exists lead_nome text null,
  add column if not exists lead_whatsapp text null;
```

- [ ] **Step 2: Testes de `saveConversationLead`**

Em `packages/core/src/agent-conversations.test.ts`, trocar o import por:

```ts
import { ensureConversation, loadHistory, messageText, saveConversationLead, saveTurn } from "./agent-conversations";
```

E acrescentar um bloco novo depois do `describe("ensureConversation", ...)`:

```ts
describe("saveConversationLead", () => {
  it("grava nome e WhatsApp só se a conversa ainda não tiver lead", async () => {
    const { client, calls } = fakeSupabase({ agent_conversations: [{}] });
    await saveConversationLead(client, "conv-1", { nome: "Ana", whatsapp: "não" });
    expect(calls).toEqual([
      { table: "agent_conversations", method: "update", args: [{ lead_nome: "Ana", lead_whatsapp: "não" }] },
      { table: "agent_conversations", method: "eq", args: ["id", "conv-1"] },
      { table: "agent_conversations", method: "is", args: ["lead_nome", null] },
    ]);
  });

  it("erro do banco não lança", async () => {
    const { client } = fakeSupabase({ agent_conversations: [{ error: { message: "down" } }] });
    await expect(saveConversationLead(client, "conv-1", { nome: "Ana", whatsapp: "não" })).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `pnpm --filter @mypet/core exec vitest run src/agent-conversations.test.ts`
Expected: FAIL (`saveConversationLead` não existe).

- [ ] **Step 4: Implementar**

Em `packages/core/src/agent-conversations.ts`, acrescentar o import:

```ts
import type { AgentLead } from "./agent-lead";
```

E logo depois da função `ensureConversation`:

```ts
// Lead do roteiro do visitante. Só preenche conversa ainda sem lead: o primeiro
// que o visitante informou fica.
export async function saveConversationLead(
  supabase: SupabaseClient,
  conversationId: string,
  lead: AgentLead,
): Promise<void> {
  try {
    const { error } = await supabase
      .from("agent_conversations")
      .update({ lead_nome: lead.nome, lead_whatsapp: lead.whatsapp })
      .eq("id", conversationId)
      .is("lead_nome", null);
    if (error) throw new Error(error.message);
  } catch (error) {
    console.error("[agent-conversations] falha ao gravar o lead:", error);
  }
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `pnpm --filter @mypet/core exec vitest run src/agent-conversations.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261020120000_agent_conversations_lead.sql packages/core/src/agent-conversations.ts packages/core/src/agent-conversations.test.ts
git commit -m "feat(agente): colunas do lead do visitante em agent_conversations

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Prompt com o nome do visitante e sem ração

**Files:**
- Modify: `packages/core/src/agent-prompt.ts`
- Modify: `packages/core/src/agent-catalog-tool.ts:53`
- Test: `packages/core/src/agent-prompt.test.ts`, `packages/core/src/agent-catalog-tool.test.ts`

**Interfaces:**
- Produces: `buildAgentInstructions` aceita `leadNome?: string | null` (opcional; os chamadores atuais continuam válidos).

- [ ] **Step 1: Testes do prompt**

Acrescentar ao `describe("buildAgentInstructions", ...)` em `packages/core/src/agent-prompt.test.ts`:

```ts
  it("visitante: nome do lead numa linha só, quando houver", () => {
    const comNome = buildAgentInstructions({ ...base, mode: "visitante", leadNome: "Ana\nSouza" });
    expect(comNome).toContain("Você atende visitantes que ainda não fizeram cadastro. Nome do visitante: Ana Souza.");
    expect(visitante).not.toContain("Nome do visitante");
  });

  it("cliente: ignora o nome do lead", () => {
    const prompt = buildAgentInstructions({ ...base, mode: "cliente", leadNome: "Ana" });
    expect(prompt).not.toContain("Nome do visitante");
  });

  it("não trabalha com ração e usa kits nos exemplos, nos dois modos", () => {
    for (const prompt of [visitante, cliente]) {
      expect(prompt).toContain("A My Pet Brasil não trabalha com ração.");
      expect(prompt).toContain("use kits, shampoo, camas ou brinquedos");
      expect(prompt).toContain("Se pedirem ração, diga que a My Pet Brasil não trabalha com ração.");
    }
  });
```

- [ ] **Step 2: Teste do exemplo da ferramenta**

Ler `packages/core/src/agent-catalog-tool.test.ts` para ver como ele importa `buildCatalogTool`. Acrescentar (ajustando o `describe` ao que já existe no arquivo):

```ts
  it("exemplos da busca não citam ração", () => {
    const catalogTool = buildCatalogTool({ channel: "mypetbrasil", showPrices: false });
    const shape = (catalogTool.inputSchema as unknown as { shape: { query: { description?: string } } }).shape;
    expect(shape.query.description).toContain("kit banho");
    expect(shape.query.description).not.toMatch(/ração/i);
  });
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `pnpm --filter @mypet/core exec vitest run src/agent-prompt.test.ts src/agent-catalog-tool.test.ts`
Expected: FAIL nos quatro testes novos.

- [ ] **Step 4: Implementar no prompt**

Em `packages/core/src/agent-prompt.ts`:

1. Renomear `MAX_EMPRESA_CHARS` → `MAX_LINE_CHARS` e `formatEmpresa` → `formatShortLine`, com o comentário:

```ts
const MAX_LINE_CHARS = 120;

// Nome da empresa (cadastro) e nome do visitante (roteiro): uma linha só e
// curto, para não virar bloco de instruções no prompt.
function formatShortLine(value: string | null): string | null {
  const flat = value?.replace(/\s+/g, " ").trim().slice(0, MAX_LINE_CHARS).trim();
  return flat || null;
}
```

2. Na assinatura de `buildAgentInstructions`, acrescentar `leadNome` ao destructuring e ao tipo:

```ts
  artigos,
  leadNome = null,
}: {
  siteName: string;
  mode: AgentMode;
  empresa: string | null;
  cart: AgentCartItem[];
  faq: readonly AgentFaqItem[];
  artigos: ArtigoAjuda[];
  leadNome?: string | null;
}): string {
```

3. Trocar o cálculo de `empresaLinha` e `audience` por:

```ts
  const empresaLinha = formatShortLine(empresa);
  const leadLinha = formatShortLine(leadNome);
  const audience = isCliente
    ? `Você atende um cliente cadastrado${empresaLinha ? `: ${empresaLinha}` : ""}.`
    : `Você atende visitantes que ainda não fizeram cadastro.${leadLinha ? ` Nome do visitante: ${leadLinha}.` : ""}`;
```

4. Na regra 7, logo depois de `Busque pelo tipo ou nome do produto (ex.: "shampoo neutro"), não pela frase inteira.`, inserir:

```
A ${siteName} não trabalha com ração. Ao dar exemplos de produtos, use kits, shampoo, camas ou brinquedos. Se pedirem ração, diga que a ${siteName} não trabalha com ração.
```

(na mesma linha da regra 7, separado por um espaço, sem quebra de linha).

- [ ] **Step 5: Implementar na ferramenta**

Em `packages/core/src/agent-catalog-tool.ts:53`, trocar a descrição de `query`:

```ts
      query: z.string().min(1).describe("Tipo ou nome do produto, ex.: 'shampoo neutro', 'kit banho'"),
```

- [ ] **Step 6: Rodar e ver passar**

Run: `pnpm --filter @mypet/core exec vitest run src/agent-prompt.test.ts src/agent-catalog-tool.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/agent-prompt.ts packages/core/src/agent-prompt.test.ts packages/core/src/agent-catalog-tool.ts packages/core/src/agent-catalog-tool.test.ts
git commit -m "feat(agente): nome do visitante no prompt e exemplos sem ração

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Servidor do agente grava o lead e passa o nome ao prompt

**Files:**
- Modify: `packages/core/src/agent-server.ts`
- Test: `packages/core/src/agent-server.test.ts`

**Interfaces:**
- Consumes: `ParsedAgentRequest.lead` (Task 1), `saveConversationLead` (Task 2), `buildAgentInstructions({ leadNome })` (Task 3).

- [ ] **Step 1: Testes**

Em `packages/core/src/agent-server.test.ts`:

1. No `vi.mock("./agent-conversations", ...)` acrescentar `saveConversationLead: vi.fn(async () => {}),`.
2. Trocar o import para `import { ensureConversation, loadHistory, saveConversationLead, saveTurn } from "./agent-conversations";`.
3. Acrescentar dentro de `describe("POST /api/agente", ...)`:

```ts
  it("visitante com lead: grava na conversa e o nome chega ao modelo", async () => {
    const model = textModel("Oi, Ana.");
    useModels(model);
    const lead = { nome: "Ana", whatsapp: "não" };
    await (await handler()(makeRequest({ ...validBody, lead }))).text();
    expect(saveConversationLead).toHaveBeenCalledWith(expect.anything(), conversationId, lead);
    expect(JSON.stringify(model.doStreamCalls[0].prompt)).toContain("Nome do visitante: Ana.");
  });

  it("cliente: ignora o lead", async () => {
    const model = textModel("Oi.");
    useModels(model);
    await (await handler({ id: "b1", empresa: "Pet Shop X" })(makeRequest({ ...validBody, lead: { nome: "Ana", whatsapp: "não" } }))).text();
    expect(saveConversationLead).not.toHaveBeenCalled();
    expect(JSON.stringify(model.doStreamCalls[0].prompt)).not.toContain("Nome do visitante");
  });

  it("visitante sem lead: não grava lead", async () => {
    useModels(textModel("Oi."));
    await (await handler()(makeRequest(validBody))).text();
    expect(saveConversationLead).not.toHaveBeenCalled();
  });

  it("conversa indisponível no banco: não tenta gravar o lead", async () => {
    (ensureConversation as Mock).mockResolvedValueOnce("unavailable");
    useModels(textModel("Oi."));
    await (await handler()(makeRequest({ ...validBody, lead: { nome: "Ana", whatsapp: "não" } }))).text();
    expect(saveConversationLead).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @mypet/core exec vitest run src/agent-server.test.ts`
Expected: FAIL no primeiro teste novo (lead não gravado nem no prompt).

- [ ] **Step 3: Implementar**

Em `packages/core/src/agent-server.ts`:

1. Acrescentar `saveConversationLead,` ao import de `./agent-conversations`.
2. Trocar `const { id, message, cart } = parsed.value;` por `const { id, message, cart, lead: requestLead } = parsed.value;`.
3. Logo depois de `const store = access === "ok" ? supabase : null;`:

```ts
    // Lead do roteiro só vale para visitante; cliente já tem cadastro.
    const lead = mode === "visitante" ? (requestLead ?? null) : null;
    if (store && lead) await saveConversationLead(store, id, lead);
```

4. Na chamada de `buildAgentInstructions`, acrescentar `leadNome: lead?.nome ?? null,` depois de `artigos,`.

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @mypet/core exec vitest run src/agent-server.test.ts`
Expected: PASS (todos).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/agent-server.ts packages/core/src/agent-server.test.ts
git commit -m "feat(agente): servidor grava o lead do visitante e usa o nome no prompt

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Navegador guarda o lead e o envia em cada pergunta

**Files:**
- Modify: `packages/core/src/agent-client.ts`
- Test: `packages/core/src/agent-client.test.ts`, `packages/core/src/agent-client.hooks.test.tsx`

**Interfaces:**
- Consumes: `AgentLead`, `normalizeAgentLead`, `LEAD_NAME_MAX`, `LEAD_WHATSAPP_MAX` (Task 1).
- Produces (de `@mypet/core/agent-client`): re-export `type AgentLead`, `normalizeAgentLead`, `LEAD_NAME_MAX`, `LEAD_WHATSAPP_MAX`; `AGENT_LEAD_STORAGE_KEY = "mypet_agente_lead"`; `loadStoredLead(storage: Storage | null): AgentLead | null`; `saveStoredLead(storage: Storage | null, lead: AgentLead): void`; `useAgentLead(): { lead: AgentLead | null; ready: boolean; saveLead: (lead: AgentLead) => void }`; `useAgentChat` aceita `getLead?: () => AgentLead | null`.

- [ ] **Step 1: Testes de storage**

Ler o topo de `packages/core/src/agent-client.test.ts` para seguir o padrão de imports. Acrescentar:

```ts
import { AGENT_LEAD_STORAGE_KEY, loadStoredLead, saveStoredLead } from "./agent-client";

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    clear: () => data.clear(),
    key: () => null,
    get length() {
      return data.size;
    },
  } as Storage;
}

describe("lead guardado", () => {
  it("grava e lê de volta", () => {
    const storage = memoryStorage();
    saveStoredLead(storage, { nome: "Ana", whatsapp: "não" });
    expect(JSON.parse(storage.getItem(AGENT_LEAD_STORAGE_KEY)!)).toEqual({ nome: "Ana", whatsapp: "não" });
    expect(loadStoredLead(storage)).toEqual({ nome: "Ana", whatsapp: "não" });
  });

  it("valor inválido, JSON quebrado ou storage ausente vira null", () => {
    expect(loadStoredLead(memoryStorage({ [AGENT_LEAD_STORAGE_KEY]: '{"nome":""}' }))).toBeNull();
    expect(loadStoredLead(memoryStorage({ [AGENT_LEAD_STORAGE_KEY]: "{" }))).toBeNull();
    expect(loadStoredLead(null)).toBeNull();
  });

  it("storage que lança não quebra", () => {
    const broken = { getItem: () => { throw new Error("bloqueado"); }, setItem: () => { throw new Error("cheio"); } } as unknown as Storage;
    expect(loadStoredLead(broken)).toBeNull();
    expect(() => saveStoredLead(broken, { nome: "Ana", whatsapp: "não" })).not.toThrow();
  });
});
```

(Se `describe`/`it`/`expect` já estiverem importados no arquivo, não duplicar o import do vitest; juntar os nomes novos ao import existente de `./agent-client`.)

- [ ] **Step 2: Testes dos hooks**

Em `packages/core/src/agent-client.hooks.test.tsx`:

1. Juntar ao import de `./agent-client`: `AGENT_LEAD_STORAGE_KEY, useAgentLead`.
2. No `beforeEach`, acrescentar `window.localStorage.clear();`.
3. Acrescentar dentro de `describe("useAgentChat", ...)`:

```ts
  it("manda o lead junto quando getLead devolve um", async () => {
    const lead = { nome: "Ana", whatsapp: "não" };
    const { result } = renderHook(() =>
      useAgentChat({ conversation, getCart: () => cart, getLead: () => lead, onConversationReset: vi.fn() }),
    );
    act(() => {
      result.current.sendText("Oi");
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.lead).toEqual(lead);
    await waitFor(() => expect(result.current.busy).toBe(false));
  });
```

4. No teste existente "envia { id, message, cart } para /api/agente", acrescentar `expect(body.lead).toBeUndefined();` depois de `expect(body.messages).toBeUndefined();`.
5. Acrescentar um bloco novo no fim do arquivo:

```ts
describe("useAgentLead", () => {
  it("lê o lead guardado depois de montar", async () => {
    window.localStorage.setItem(AGENT_LEAD_STORAGE_KEY, JSON.stringify({ nome: "Ana", whatsapp: "não" }));
    const { result } = renderHook(() => useAgentLead());
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.lead).toEqual({ nome: "Ana", whatsapp: "não" });
  });

  it("sem lead guardado: pronto e nulo; saveLead grava e atualiza", async () => {
    const { result } = renderHook(() => useAgentLead());
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.lead).toBeNull();
    act(() => result.current.saveLead({ nome: "Bia", whatsapp: "11999990000" }));
    expect(result.current.lead).toEqual({ nome: "Bia", whatsapp: "11999990000" });
    expect(JSON.parse(window.localStorage.getItem(AGENT_LEAD_STORAGE_KEY)!)).toEqual({
      nome: "Bia",
      whatsapp: "11999990000",
    });
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `pnpm --filter @mypet/core exec vitest run src/agent-client.test.ts src/agent-client.hooks.test.tsx`
Expected: FAIL (exports novos não existem).

- [ ] **Step 4: Implementar em `agent-client.ts`**

1. Imports e re-exports, junto aos existentes:

```ts
import { normalizeAgentLead, type AgentLead } from "./agent-lead";
```

```ts
export type { AgentLead };
export { normalizeAgentLead, LEAD_NAME_MAX, LEAD_WHATSAPP_MAX } from "./agent-lead";
```

2. Atualizar o comentário do topo para: `Ao servidor vão só { id, message, cart } (e o lead do visitante): o histórico ele lê do banco.`

3. Depois de `AGENT_STORAGE_KEY`:

```ts
// O lead fica no localStorage: vale para as próximas conversas e visitas.
export const AGENT_LEAD_STORAGE_KEY = "mypet_agente_lead";
```

4. Depois de `safeSessionStorage`:

```ts
function safeLocalStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function loadStoredLead(storage: Storage | null): AgentLead | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(AGENT_LEAD_STORAGE_KEY);
    return raw ? normalizeAgentLead(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function saveStoredLead(storage: Storage | null, lead: AgentLead): void {
  if (!storage) return;
  try {
    storage.setItem(AGENT_LEAD_STORAGE_KEY, JSON.stringify(lead));
  } catch {
    // storage cheio ou bloqueado: o lead vale só nesta página
  }
}
```

5. Depois de `useAgentConversation`:

```ts
// Lê o lead só depois de montar, como a conversa. Até `ready`, a tela ainda não
// sabe se precisa do roteiro.
export function useAgentLead() {
  const [lead, setLead] = useState<AgentLead | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLead(loadStoredLead(safeLocalStorage()));
    setReady(true);
  }, []);

  const saveLead = useCallback((next: AgentLead) => {
    saveStoredLead(safeLocalStorage(), next);
    setLead(next);
  }, []);

  return { lead, ready, saveLead };
}
```

6. Em `useAgentChat`: acrescentar `getLead,` ao destructuring e `getLead?: () => AgentLead | null;` ao tipo; logo depois de `getCartRef.current = getCart;`:

```ts
  const getLeadRef = useRef(getLead);
  getLeadRef.current = getLead;
```

E trocar o `prepareSendMessagesRequest` por:

```ts
        prepareSendMessagesRequest: ({ id, messages }) => {
          const lead = getLeadRef.current?.() ?? null;
          return {
            body: {
              id,
              message: messages[messages.length - 1],
              cart: getCartRef.current?.() ?? [],
              ...(lead ? { lead } : {}),
            },
          };
        },
```

- [ ] **Step 5: Rodar e ver passar**

Run: `pnpm --filter @mypet/core exec vitest run src/agent-client.test.ts src/agent-client.hooks.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/agent-client.ts packages/core/src/agent-client.test.ts packages/core/src/agent-client.hooks.test.tsx
git commit -m "feat(agente): navegador guarda o lead do visitante e o envia em cada pergunta

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Roteiro do visitante e saudação no chat

**Files:**
- Modify: `apps/mypet/app/agente/agent-chat.tsx`
- Test: `apps/mypet/app/agente/agent-chat.test.tsx`

**Interfaces:**
- Consumes: `useAgentLead`, `normalizeAgentLead`, `LEAD_NAME_MAX`, `LEAD_WHATSAPP_MAX`, `type AgentLead`, `useAgentChat({ getLead })` (Task 5).
- Produces: `AgentChat` aceita a prop opcional `displayName?: string | null` (nome de exibição do cliente; usada na Task 7).

- [ ] **Step 1: Ajustar o mock e escrever os testes**

Em `apps/mypet/app/agente/agent-chat.test.tsx`:

1. No `vi.hoisted` de `chat`, acrescentar:

```ts
  lead: { nome: "Ana", whatsapp: "não" } as { nome: string; whatsapp: string } | null,
  leadReady: true,
  saveLead: vi.fn(),
```

e trocar o tipo de `lastArgs` para `null as null | { onAssistantMessage?: (message: AgentMessage) => void; getLead?: () => unknown }`.

2. No `vi.mock("@mypet/core/agent-client", ...)`, acrescentar ao objeto retornado:

```ts
    useAgentLead: () => ({ lead: chat.lead, ready: chat.leadReady, saveLead: chat.saveLead }),
```

e trocar a assinatura do mock de `useAgentChat` para `(args: { onAssistantMessage?: (message: AgentMessage) => void; getLead?: () => unknown })`.

3. No `beforeEach`, acrescentar:

```ts
  chat.lead = { nome: "Ana", whatsapp: "não" };
  chat.leadReady = true;
  chat.saveLead = vi.fn((lead) => {
    chat.lead = lead;
  });
```

4. No teste "visitante: boas-vindas com intenções livres e com cadeado", trocar o heading esperado por `"Olá, Ana! Como posso te ajudar hoje?"`.

5. Acrescentar ao `describe("AgentChat", ...)`:

```ts
  it("visitante sem lead: roteiro de nome e WhatsApp antes das intenções", () => {
    chat.lead = null;
    const view = renderChat("visitante");
    expect(screen.getByText("Antes de prosseguir, preciso de duas informações: 1 - Qual é o seu nome?")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Frete e prazos de entrega/ })).toBeNull();

    const input = screen.getByRole("textbox", { name: "Sua resposta" });
    fireEvent.change(input, { target: { value: "  Ana  " } });
    fireEvent.submit(input.closest("form")!);
    expect(screen.getByText("Ana", { selector: ".ag-msg--user" })).toBeInTheDocument();
    expect(screen.getByText("2 - Deseja informar um WhatsApp?")).toBeInTheDocument();
    expect(chat.saveLead).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "não" } });
    fireEvent.submit(input.closest("form")!);
    expect(chat.saveLead).toHaveBeenCalledWith({ nome: "Ana", whatsapp: "não" });
    expect(chat.sendText).not.toHaveBeenCalled();

    view.rerender();
    expect(screen.getByRole("heading", { name: "Obrigado, Ana! Como posso te ajudar hoje?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Frete e prazos de entrega/ })).toBeInTheDocument();
  });

  it("visitante sem lead: nome vazio não avança", () => {
    chat.lead = null;
    renderChat("visitante");
    const input = screen.getByRole("textbox", { name: "Sua resposta" });
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.submit(input.closest("form")!);
    expect(screen.queryByText("2 - Deseja informar um WhatsApp?")).toBeNull();
  });

  it("visitante: pergunta da URL só sai depois do roteiro", () => {
    chat.lead = null;
    const view = renderChat("visitante", { initialQuestion: "Tem shampoo?" });
    expect(chat.sendText).not.toHaveBeenCalled();
    const input = screen.getByRole("textbox", { name: "Sua resposta" });
    fireEvent.change(input, { target: { value: "Ana" } });
    fireEvent.submit(input.closest("form")!);
    fireEvent.change(input, { target: { value: "não" } });
    fireEvent.submit(input.closest("form")!);
    view.rerender();
    expect(chat.sendText).toHaveBeenCalledWith("Tem shampoo?");
  });

  it("visitante: lead ainda carregando não mostra intenções nem roteiro", () => {
    chat.lead = null;
    chat.leadReady = false;
    renderChat("visitante");
    expect(screen.queryByText(/Antes de prosseguir/)).toBeNull();
    expect(screen.queryByRole("button", { name: /Frete e prazos de entrega/ })).toBeNull();
  });

  it("visitante: getLead manda o lead; cliente não manda", () => {
    renderChat("visitante");
    expect(chat.lastArgs?.getLead?.()).toEqual({ nome: "Ana", whatsapp: "não" });
  });

  it("cliente: nunca vê o roteiro e é saudado pelo nome de exibição", () => {
    chat.lead = null;
    renderChat("cliente", { displayName: "Bruno" });
    expect(screen.queryByText(/Antes de prosseguir/)).toBeNull();
    expect(screen.getByRole("heading", { name: "Olá, Bruno! Como posso te ajudar hoje?" })).toBeInTheDocument();
    expect(chat.lastArgs?.getLead?.()).toBeNull();
  });

  it("cliente sem nome de exibição: saudação padrão", () => {
    renderChat("cliente");
    expect(screen.getByRole("heading", { name: "Como posso te ajudar hoje?" })).toBeInTheDocument();
  });
```

Observação: `renderChat` usa `render(...)` e devolve `props`; para o `rerender`, trocar a função por:

```ts
function renderChat(mode: "visitante" | "cliente", extra: Partial<Parameters<typeof AgentChat>[0]> = {}) {
  const props = {
    mode,
    initialQuestion: null,
    onInitialQuestionUsed: vi.fn(),
    onLockedIntent: vi.fn(),
    ...extra,
  };
  const view = render(<AgentChat {...props} />);
  return { ...props, rerender: () => view.rerender(<AgentChat {...props} />) };
}
```

(Os testes antigos usam só `props.onLockedIntent` etc., que continuam no objeto devolvido.) O `rerender` simula o que o hook real faz: `saveLead` troca o estado e o componente renderiza de novo com o lead novo.

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter mypet exec vitest run app/agente/agent-chat.test.tsx`
Expected: FAIL nos testes novos e no heading do teste de visitante.

- [ ] **Step 3: Implementar em `agent-chat.tsx`**

1. Imports de `@mypet/core/agent-client`: acrescentar `LEAD_NAME_MAX`, `LEAD_WHATSAPP_MAX`, `normalizeAgentLead`, `useAgentLead`, `type AgentLead`.

2. Em `AgentChatProps`, acrescentar:

```ts
  // nome de exibição do cliente logado (cadastro: nome, senão empresa)
  displayName?: string | null;
```

3. Constantes, depois de `LOCKED_INTENTS`:

```ts
const LEAD_ASK_NAME = "Antes de prosseguir, preciso de duas informações: 1 - Qual é o seu nome?";
const LEAD_ASK_WHATSAPP = "2 - Deseja informar um WhatsApp?";
const DEFAULT_GREETING = "Como posso te ajudar hoje?";
```

4. Em `AgentChatSession`, acrescentar `displayName` aos props desestruturados. Logo depois de `const { cart, addItem, setLine } = useCart();`:

```ts
  // Roteiro fixo do visitante (sem IA): nome e WhatsApp antes da primeira pergunta.
  const { lead, ready: leadReady, saveLead } = useAgentLead();
  const isVisitor = mode === "visitante";
  const leadRef = useRef(lead);
  leadRef.current = lead;
  const [nomeAnswer, setNomeAnswer] = useState<string | null>(null);
  const [completedLead, setCompletedLead] = useState<AgentLead | null>(null);
  const needsLead = isVisitor && leadReady && !lead;
  const leadPending = isVisitor && !lead;
```

5. Na chamada de `useAgentChat`, acrescentar:

```ts
    getLead: () => (isVisitor ? leadRef.current : null),
```

6. Depois de `handleAdd`, a função do roteiro:

```ts
  // Resposta do roteiro: true quando aceita (o campo é limpo).
  const answerLead = (text: string): boolean => {
    if (nomeAnswer === null) {
      const nome = normalizeAgentLead({ nome: text, whatsapp: "-" })?.nome;
      if (!nome) return false;
      setNomeAnswer(nome);
      return true;
    }
    const answered = normalizeAgentLead({ nome: nomeAnswer, whatsapp: text });
    if (!answered) return false;
    saveLead(answered);
    setCompletedLead(answered);
    return true;
  };
```

7. No efeito da pergunta inicial, logo depois de `if (!initialQuestion || sentInitial.current) return;`:

```ts
    // visitante responde o roteiro antes; a pergunta espera
    if (leadPending) return;
```

e acrescentar `leadPending` ao array de dependências do efeito.

8. Saudação, antes do `return` do componente:

```ts
  const greetingName = isVisitor ? (completedLead ?? lead)?.nome : displayName;
  const greeting = greetingName
    ? `${completedLead ? "Obrigado" : "Olá"}, ${greetingName}! ${DEFAULT_GREETING}`
    : DEFAULT_GREETING;
  const showWelcome = messages.length === 0 && !leadPending;
```

9. No JSX do `ag-log`, logo depois do bloco do `notice`, inserir o roteiro:

```tsx
        {(needsLead || completedLead) && (
          <>
            <p className="ag-msg">{LEAD_ASK_NAME}</p>
            {nomeAnswer !== null && (
              <>
                <p className="ag-msg ag-msg--user">{nomeAnswer}</p>
                <p className="ag-msg">{LEAD_ASK_WHATSAPP}</p>
              </>
            )}
            {completedLead && <p className="ag-msg ag-msg--user">{completedLead.whatsapp}</p>}
          </>
        )}
```

10. Trocar a condição `messages.length === 0 ? (` por `showWelcome ? (` e, no `ag-welcome`, trocar `<h2>Como posso te ajudar hoje?</h2>` por `<h2>{greeting}</h2>`. No ramo `: (` das mensagens, manter o `messages.map(...)` (com `messages` vazio e roteiro pendente ele não renderiza nada).

11. Trocar o `<form>` por:

```tsx
      <form
        className="ag-form"
        onSubmit={(event) => {
          event.preventDefault();
          const accepted = needsLead ? answerLead(input) : sendText(input);
          if (accepted) setInput("");
        }}
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={
            needsLead
              ? nomeAnswer === null
                ? "Seu nome"
                : "Seu WhatsApp ou \"não\""
              : "Pergunte qualquer coisa sobre a My Pet Brasil…"
          }
          aria-label={needsLead ? "Sua resposta" : "Sua pergunta"}
          maxLength={needsLead ? (nomeAnswer === null ? LEAD_NAME_MAX : LEAD_WHATSAPP_MAX) : 500}
        />
        <button type="submit" aria-label="Enviar" disabled={busy || !input.trim() || (isVisitor && !leadReady)}>
          ↑
        </button>
      </form>
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter mypet exec vitest run app/agente/agent-chat.test.tsx`
Expected: PASS (todos, antigos e novos).

- [ ] **Step 5: Commit**

```bash
git add apps/mypet/app/agente/agent-chat.tsx apps/mypet/app/agente/agent-chat.test.tsx
git commit -m "feat(agente): roteiro de nome e WhatsApp do visitante e saudação pelo nome

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Logout e "Olá, [nome]" no cabeçalho do cliente

**Files:**
- Modify: `packages/core/src/access-session.ts`, `packages/core/package.json`
- Test: `packages/core/src/access-session.test.ts`
- Create: `apps/mypet/app/api/sair/route.ts`, `apps/mypet/app/api/sair/route.test.ts`
- Create: `apps/mypet/app/agente/navigate.ts`
- Modify: `apps/mypet/app/agente/agent-shell.tsx`, `apps/mypet/app/agente/page.tsx`, `apps/mypet/app/agente/styles.ts`
- Test: `apps/mypet/app/agente/agent-shell.test.tsx`, `apps/mypet/app/agente/page.test.tsx`

**Interfaces:**
- Consumes: `AgentChat` prop `displayName` (Task 6); `AGENT_STORAGE_KEY` de `@mypet/core/agent-client`; `useCart().clear`.
- Produces: `expiredAccessCookie(): string` em `@mypet/core/access-session`; export `@mypet/core/request-guards`; `POST /api/sair`; `goTo(url: string): void` em `./navigate`; `AgentShell` exige a prop `displayName: string | null`.

- [ ] **Step 1: Ler a doc de rotas do Next desta versão**

Run: `ls node_modules/next/dist/docs/` e ler o guia de Route Handlers (o arquivo cujo nome cita `route`). Confirmar que `export async function POST(req: NextRequest)` num `route.ts` continua sendo o formato (é o que `apps/mypet/app/api/pre-acesso/route.ts` usa).

- [ ] **Step 2: Teste de `expiredAccessCookie`**

Acrescentar a `packages/core/src/access-session.test.ts` (juntar `expiredAccessCookie` ao import existente de `./access-session`):

```ts
describe("expiredAccessCookie", () => {
  it("expira o cookie de acesso com os mesmos atributos", () => {
    expect(expiredAccessCookie()).toBe("mypet_acesso=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly; Secure");
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `pnpm --filter @mypet/core exec vitest run src/access-session.test.ts`
Expected: FAIL (`expiredAccessCookie` não existe).

- [ ] **Step 4: Implementar e exportar `request-guards`**

Em `packages/core/src/access-session.ts`, depois de `ACCESS_COOKIE_OPTS`:

```ts
// Set-Cookie do logout: mesmo nome e atributos, valor vazio e Max-Age=0.
export function expiredAccessCookie(): string {
  const { path, sameSite, httpOnly, secure } = ACCESS_COOKIE_OPTS;
  return [
    `${ACCESS_COOKIE}=`,
    `Path=${path}`,
    "Max-Age=0",
    `SameSite=${sameSite === "lax" ? "Lax" : sameSite}`,
    httpOnly ? "HttpOnly" : "",
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}
```

Em `packages/core/package.json`, no mapa `exports`, acrescentar (perto de `./access-session`):

```json
    "./request-guards": "./src/request-guards.ts",
```

Run: `pnpm --filter @mypet/core exec vitest run src/access-session.test.ts`
Expected: PASS.

- [ ] **Step 5: Teste da rota `/api/sair`**

Criar `apps/mypet/app/api/sair/route.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

function request(headers: Record<string, string>): NextRequest {
  return new NextRequest("http://localhost/api/sair", { method: "POST", headers, body: "{}" });
}

describe("POST /api/sair", () => {
  it("expira o cookie de acesso", async () => {
    const res = await POST(request({ "content-type": "application/json", origin: "http://localhost", host: "localhost" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("mypet_acesso=;");
    expect(res.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("recusa requisição de outra origem e não mexe no cookie", async () => {
    const res = await POST(request({ "content-type": "application/json", origin: "https://evil.example", host: "localhost" }));
    expect(res.status).toBe(403);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("recusa corpo que não é JSON", async () => {
    const res = await POST(request({ "content-type": "text/plain" }));
    expect(res.status).toBe(415);
  });
});
```

Run: `pnpm --filter mypet exec vitest run app/api/sair/route.test.ts`
Expected: FAIL (rota não existe).

- [ ] **Step 6: Implementar a rota**

Criar `apps/mypet/app/api/sair/route.ts`:

```ts
import type { NextRequest } from "next/server";
import { expiredAccessCookie } from "@mypet/core/access-session";
import { rejectForeignRequest } from "@mypet/core/request-guards";

// Logout: apaga o cookie de acesso. Só do próprio site, para outro site não
// deslogar o cliente.
export async function POST(req: NextRequest): Promise<Response> {
  const foreign = rejectForeignRequest(req);
  if (foreign) return foreign;
  const res = Response.json({ ok: true });
  res.headers.append("Set-Cookie", expiredAccessCookie());
  return res;
}
```

Run: `pnpm --filter mypet exec vitest run app/api/sair/route.test.ts`
Expected: PASS.

- [ ] **Step 7: Testes do cabeçalho e da página**

Criar `apps/mypet/app/agente/navigate.ts`:

```ts
// Navegação com recarga completa. Separada para os testes poderem trocar
// (jsdom não deixa sobrescrever window.location).
export function goTo(url: string): void {
  window.location.assign(url);
}
```

Em `apps/mypet/app/agente/agent-shell.test.tsx`:

1. Trocar o mock do carrinho por:

```ts
const shellCart = vi.hoisted(() => ({ items: [] as ShellCartItem[], clear: vi.fn() }));
vi.mock("@mypet/core/components/cart-provider", () => ({
  useCart: () => ({ cart: { items: shellCart.items }, clear: shellCart.clear }),
}));
const nav = vi.hoisted(() => ({ goTo: vi.fn() }));
vi.mock("./navigate", () => ({ goTo: nav.goTo }));
```

(manter a declaração `type ShellCartItem` antes, como está.)

2. Todo `render(<AgentShell ... />)` existente passa a incluir `displayName={null}` (buscar por `<AgentShell` no arquivo e acrescentar a prop em cada um).

3. Acrescentar os testes (no `describe` principal do arquivo; `mockViewport(false)` antes de renderizar, como os testes existentes fazem):

```ts
  it("cliente: cabeçalho com Olá e o nome, e botão Sair", () => {
    mockViewport(false);
    render(<AgentShell mode="cliente" initialQuestion={null} displayName="Ana" />);
    expect(screen.getByText("Olá, Ana")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sair" })).toBeInTheDocument();
  });

  it("cliente sem nome: Olá!", () => {
    mockViewport(false);
    render(<AgentShell mode="cliente" initialQuestion={null} displayName={null} />);
    expect(screen.getByText("Olá!")).toBeInTheDocument();
  });

  it("visitante: sem Sair", () => {
    mockViewport(false);
    render(<AgentShell mode="visitante" initialQuestion={null} displayName={null} />);
    expect(screen.queryByRole("button", { name: "Sair" })).toBeNull();
  });

  it("Sair: chama /api/sair, limpa carrinho e conversa e vai para a home", async () => {
    mockViewport(false);
    window.sessionStorage.setItem("mypet-agente-conversa", "{}");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<AgentShell mode="cliente" initialQuestion={null} displayName="Ana" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Sair" }));
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/sair", expect.objectContaining({ method: "POST" }));
    expect(shellCart.clear).toHaveBeenCalled();
    expect(window.sessionStorage.getItem("mypet-agente-conversa")).toBeNull();
    expect(nav.goTo).toHaveBeenCalledWith("/");
  });

  it("Sair com falha: mostra erro e não limpa nada", async () => {
    mockViewport(false);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })));
    render(<AgentShell mode="cliente" initialQuestion={null} displayName="Ana" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Sair" }));
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível sair agora. Tente de novo.");
    expect(shellCart.clear).not.toHaveBeenCalled();
    expect(nav.goTo).not.toHaveBeenCalled();
  });
```

Garantir no `beforeEach` do arquivo: `shellCart.clear.mockClear(); nav.goTo.mockClear();`, e no `afterEach`: `vi.unstubAllGlobals();` (se ainda não houver).

Em `apps/mypet/app/agente/page.test.tsx`, trocar os dois testes de `AgentePageBody` por:

```ts
  it("visitante quando não há comprador", async () => {
    requireBuyer.mockResolvedValue(null);
    const tree = await AgentePageBody({ searchParams: Promise.resolve({ pergunta: "Tem shampoo?" }) });
    expect(tree.type).toBe(AgentShell);
    expect(tree.props).toEqual({ mode: "visitante", initialQuestion: "Tem shampoo?", displayName: null });
  });

  it("cliente quando há comprador, com o nome do cadastro", async () => {
    requireBuyer.mockResolvedValue({ id: "b1", nome: " Ana ", empresa: "Pet X" });
    const tree = await AgentePageBody({ searchParams: Promise.resolve({}) });
    expect(tree.props).toEqual({ mode: "cliente", initialQuestion: null, displayName: "Ana" });
  });

  it("cliente sem nome usa a empresa; sem os dois, null", async () => {
    requireBuyer.mockResolvedValue({ id: "b1", nome: null, empresa: "Pet X" });
    expect((await AgentePageBody({ searchParams: Promise.resolve({}) })).props.displayName).toBe("Pet X");
    requireBuyer.mockResolvedValue({ id: "b1", nome: "  ", empresa: null });
    expect((await AgentePageBody({ searchParams: Promise.resolve({}) })).props.displayName).toBeNull();
  });
```

- [ ] **Step 8: Rodar e ver falhar**

Run: `pnpm --filter mypet exec vitest run app/agente/agent-shell.test.tsx app/agente/page.test.tsx`
Expected: FAIL nos testes novos.

- [ ] **Step 9: Implementar página, cabeçalho e estilos**

Em `apps/mypet/app/agente/page.tsx`, trocar o `return` de `AgentePageBody` por:

```tsx
  // nome de exibição do cliente: nome do cadastro, senão a empresa
  const displayName = buyer ? buyer.nome?.trim() || buyer.empresa?.trim() || null : null;
  return <AgentShell mode={buyer ? "cliente" : "visitante"} initialQuestion={initialQuestion} displayName={displayName} />;
```

Em `apps/mypet/app/agente/agent-shell.tsx`:

1. Imports:

```ts
import { AGENT_STORAGE_KEY } from "@mypet/core/agent-client";
import { goTo } from "./navigate";
```

2. Constante depois de `const { name: SITE_NAME, logo } = clientConfig;`:

```ts
const LOGOUT_ERROR = "Não foi possível sair agora. Tente de novo.";
```

3. Assinatura:

```ts
export function AgentShell({
  mode,
  initialQuestion,
  displayName,
}: {
  mode: AgentPageMode;
  initialQuestion: string | null;
  displayName: string | null;
}) {
```

4. Dentro do componente, depois dos `useState` existentes:

```ts
  const { clear: clearCart } = useCart();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  // Só limpa carrinho e conversa depois que o cookie foi apagado: se a rota
  // falhar, o cliente continua logado com o pedido intacto.
  const handleLogout = useCallback(async () => {
    setLogoutError(null);
    setLoggingOut(true);
    try {
      const res = await fetch("/api/sair", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
    } catch {
      setLoggingOut(false);
      setLogoutError(LOGOUT_ERROR);
      return;
    }
    clearCart();
    try {
      window.sessionStorage.removeItem(AGENT_STORAGE_KEY);
    } catch {
      // storage bloqueado: nada guardado para apagar
    }
    goTo("/");
  }, [clearCart]);
```

5. No `<nav>`, trocar o ramo do cliente por:

```tsx
              <>
                <span className="ag-hello">{displayName ? `Olá, ${displayName}` : "Olá!"}</span>
                <a href="/pedido-rapido">Tabela de preços</a>
                <a href="/pedidos">Meus pedidos</a>
                <button type="button" className="ag-logout" onClick={handleLogout} disabled={loggingOut}>
                  Sair
                </button>
              </>
```

6. Logo depois do `</div>` que fecha `pa-wrap pa-header-row` (ainda dentro do `<header>`):

```tsx
        {logoutError && (
          <p className="ag-logout-error" role="alert">
            {logoutError}
          </p>
        )}
```

7. Passar `displayName` ao `AgentChat`: acrescentar `displayName={displayName}` nas props dele.

Em `apps/mypet/app/agente/styles.ts`, depois da linha `.ag-header-links a:hover { ... }`:

```css
  .ag-hello { color: var(--pa-navy); font-weight: 600; font-size: 14px; }
  .ag-logout { background: none; border: 1px solid var(--pa-line); border-radius: 999px; padding: 6px 14px; font: inherit; font-size: 14px; font-weight: 500; color: var(--pa-muted); cursor: pointer; }
  .ag-logout:hover { color: var(--pa-navy); border-color: var(--pa-navy); }
  .ag-logout:disabled { opacity: 0.6; cursor: default; }
  .ag-logout-error { max-width: 1180px; margin: 0 auto; padding: 0 24px 8px; color: #b42318; font-size: 14px; text-align: right; }
```

E dentro do `@media` do celular já existente (onde está `.ag-header-links a.ag-hide-mobile { display: none; }`), acrescentar:

```css
    .ag-header-links { gap: 12px; }
    .ag-hello { display: none; }
```

(No celular a saudação já aparece no chat; o cabeçalho fica só com os links e o Sair.)

- [ ] **Step 10: Rodar e ver passar**

Run: `pnpm --filter mypet exec vitest run app/agente app/api/sair`
Expected: PASS (todos os testes do /agente e da rota).

- [ ] **Step 11: Commit**

```bash
git add packages/core/src/access-session.ts packages/core/src/access-session.test.ts packages/core/package.json apps/mypet/app/api/sair apps/mypet/app/agente/navigate.ts apps/mypet/app/agente/agent-shell.tsx apps/mypet/app/agente/agent-shell.test.tsx apps/mypet/app/agente/page.tsx apps/mypet/app/agente/page.test.tsx apps/mypet/app/agente/styles.ts
git commit -m "feat(agente): Olá com o nome do cliente e botão Sair no /agente

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Lead na página da conversa do admin

**Files:**
- Modify: `apps/admin/app/(dashboard)/agente/[id]/page.tsx`

**Interfaces:**
- Consumes: colunas `lead_nome`, `lead_whatsapp` de `agent_conversations` (Task 2). O admin já lê `agent_conversations` pelas políticas de select do dashboard.

- [ ] **Step 1: Buscar o lead junto com o resto**

Em `ConversaContent`, trocar o `Promise.all` para incluir a consulta do lead:

```ts
  const [messagesResult, eventsResult, ordersResult, leadResult] = await Promise.all([
    supabase.from("agent_messages").select(MESSAGE_COLUMNS).eq("conversation_id", id).order("created_at").limit(500),
    supabase.from("agent_events").select(EVENT_COLUMNS).eq("conversation_id", id).order("created_at").limit(500),
    supabase
      .from("orders")
      .select(ORDERS_SELECT)
      .eq("agent_conversation_id", id)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase.from("agent_conversations").select("lead_nome, lead_whatsapp").eq("id", id).maybeSingle(),
  ]);
```

E depois de `const order = ...`:

```ts
  // Lead do roteiro do visitante; erro aqui não esconde a conversa.
  const lead = (leadResult.data ?? null) as { lead_nome: string | null; lead_whatsapp: string | null } | null;
```

- [ ] **Step 2: Mostrar no cabeçalho**

Logo depois do `<p className="text-sm text-slate-500">Início ...</p>`:

```tsx
        {lead?.lead_nome && (
          <p className="mt-1 text-sm text-slate-600">
            Nome: {lead.lead_nome}
            {lead.lead_whatsapp && ` · WhatsApp informado: ${lead.lead_whatsapp}`}
          </p>
        )}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter admin exec tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add "apps/admin/app/(dashboard)/agente/[id]/page.tsx"
git commit -m "feat(admin): nome e WhatsApp do lead na conversa do agente

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Verificação final e migration

- [ ] **Step 1: Suítes completas**

Run: `pnpm --filter @mypet/core test` e `pnpm --filter mypet test` e `pnpm --filter admin test`
Expected: tudo PASS.

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @mypet/core exec tsc --noEmit`, `pnpm --filter mypet exec tsc --noEmit`, `pnpm --filter admin exec tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Conferir copy proibida**

Run: `git diff 37a6af9 -- apps packages | grep -i -E "atacado|cotação|ração"`
Expected: só as linhas da regra "não trabalha com ração" e do teste dela.

- [ ] **Step 4: Migration no Supabase**

A migration `20261020120000_agent_conversations_lead.sql` precisa ser aplicada no projeto `hsguyfiyqpuligijcjlw` antes do deploy (sem ela, `saveConversationLead` só registra erro no console e o admin não mostra o lead; o agente segue funcionando). Aplicar pelo fluxo de sempre do projeto (Supabase MCP `apply_migration` ou `supabase db push`), com confirmação do usuário.

- [ ] **Step 5: Teste manual no navegador**

Run: `pnpm --filter mypet dev` e abrir `http://localhost:4100/agente`:
- janela anônima: roteiro aparece; responder nome e "não"; "Obrigado, [nome]!..." e intenções; recarregar → "Olá, [nome]!..." sem roteiro;
- com `?pergunta=Tem%20shampoo%3F`: a pergunta só sai depois do roteiro;
- logado: "Olá, [nome]" e Sair no cabeçalho; Sair volta para a home e /agente abre como visitante;
- perguntar "quais produtos vocês têm?": a resposta não cita ração.
