# Assistente de busca: layout de chat contínuo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar `AssistantSearch` numa conversa de chat de verdade (bolhas + input fixo abaixo da conversa), em vez de mostrar só a última troca com o input fixo no topo.

**Architecture:** Refatoração contida em um único arquivo já existente, `packages/core/src/components/assistant-search.tsx`. Sem novos componentes, sem mudança de contrato de API (`assistant-client.ts` e `assistant-server.ts` não mudam). O array `messages`, que já guarda o histórico completo, passa a ser a única fonte de verdade para a renderização (os estados redundantes `lastUserMessage`/`reply` são removidos).

**Tech Stack:** React 19 (Client Component), TypeScript, sem CSS externo (estilos inline via `style={{...}}`, seguindo o padrão já usado no arquivo).

## Global Constraints

- Spec de referência: `docs/superpowers/specs/2026-07-11-assistente-chat-continuo-design.md`.
- Sem novos arquivos/subcomponentes — tudo dentro de `assistant-search.tsx` (decisão da spec, seção "Estrutura de código").
- Sem persistência entre reloads (sem localStorage).
- Sem testes automatizados de componente novos — o projeto não usa React Testing Library em nenhum lugar; validação é manual via `/run` (decisão da spec, seção "Estratégia de testes").
- Nenhuma mudança no contrato de `POST /api/assistant`, em `assistant-client.ts` ou em `assistant-server.ts`.
- `ProductCard` e o grid de produtos continuam reaproveitados sem alteração de props.

---

### Task 1: Refatorar `AssistantSearch` para layout de chat contínuo

**Files:**
- Modify: `packages/core/src/components/assistant-search.tsx` (reescrita completa do corpo do componente — arquivo tem 151 linhas hoje)

**Interfaces:**
- Consumes: `askAssistant(channel, messages)` de `../assistant-client` (assinatura inalterada: recebe `channel: string, messages: AssistantMessage[]`, devolve `{ ok: true, reply: string, products: CatalogProduct[], profileOptions?: AssistantProfileOption[] } | { ok: false, error: string }`); `ProductCard` de `./product-card` (prop `product: CatalogProduct`, inalterada); tipos `AssistantMessage`, `AssistantProfileOption` de `../assistant-client`; `Palette` de `../theme`; `CatalogProduct` de `../catalog-utils`.
- Produces: `AssistantSearch({ channel, palette }: { channel: string; palette: Palette })` — mesma assinatura pública de hoje, nenhum consumidor (`apps/mypet/app/page.tsx:312`, `apps/distribuidora/app/page.tsx`) precisa mudar.

Não há testes automatizados para este componente (nenhum arquivo `assistant-search.test.tsx` existe, e o projeto não tem React Testing Library configurado em nenhum `package.json`). A verificação desta task é: (1) type-check limpo, (2) checklist manual no navegador via `/run`.

- [ ] **Step 1: Ler o arquivo atual para confirmar que nada mudou desde a spec**

Rode:
```bash
git -C c:/Projetos/mypet-landing diff --stat packages/core/src/components/assistant-search.tsx
```
Esperado: nenhuma saída (arquivo limpo, sem mudanças pendentes). Se houver saída, pare e avise — outra alteração pode ter acontecido em paralelo.

- [ ] **Step 2: Substituir o conteúdo do arquivo**

Escreva exatamente este conteúdo em `packages/core/src/components/assistant-search.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import type { Palette } from "../theme";
import type { CatalogProduct } from "../catalog-utils";
import { askAssistant, type AssistantMessage, type AssistantProfileOption } from "../assistant-client";
import { ProductCard } from "./product-card";

const SUGESTOES_INICIAIS = [
  "Quero montar um pet shop do zero",
  "Preciso de produtos para banho e tosa",
  "Buscar ração para filhotes",
];

export function AssistantSearch({ channel, palette }: { channel: string; palette: Palette }) {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [profileOptions, setProfileOptions] = useState<AssistantProfileOption[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const hasConversation = messages.length > 0;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const nextMessages: AssistantMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setError(null);
    setLoading(true);
    setProfileOptions([]);

    const result = await askAssistant(channel, nextMessages);

    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setProducts(result.products);
    setProfileOptions(result.profileOptions ?? []);
    setMessages([...nextMessages, { role: "assistant", content: result.reply }]);
  }

  return (
    <section
      style={{
        maxWidth: 760,
        margin: "0 auto 56px",
        background: palette.white,
        borderRadius: 24,
        padding: "32px 28px",
        boxShadow: "0 24px 60px rgba(15,31,69,0.18)",
        position: "relative",
      }}
    >
      <h2 style={{ fontSize: 22, fontWeight: 900, color: palette.navy, marginBottom: 4, textAlign: "center" }}>
        O que você está procurando hoje?
      </h2>
      <p style={{ fontSize: 14, color: palette.gray600, marginBottom: 20, textAlign: "center" }}>
        Descreva o que precisa — a gente entende se você é pet shop ou banho e tosa e recomenda os produtos certos.
      </p>

      {hasConversation && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            maxHeight: 360,
            overflowY: "auto",
            padding: "4px 4px 12px",
            marginBottom: 12,
          }}
        >
          {messages.map((message, index) => (
            <div
              key={index}
              style={{
                alignSelf: message.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "80%",
                background: message.role === "user" ? palette.navy : palette.gray100,
                color: message.role === "user" ? palette.white : palette.gray800,
                borderRadius: 14,
                padding: "10px 14px",
                fontSize: 15,
                lineHeight: 1.5,
              }}
            >
              {message.content}
            </div>
          ))}
          {loading && (
            <div
              style={{
                alignSelf: "flex-start",
                maxWidth: "80%",
                background: palette.gray100,
                color: palette.gray600,
                borderRadius: 14,
                padding: "10px 14px",
                fontSize: 15,
              }}
            >
              Digitando…
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {profileOptions.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          {profileOptions.map((opt: AssistantProfileOption) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => sendMessage(opt.value)}
              className="cat-btn"
              disabled={loading}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage(input);
        }}
        style={{ display: "flex", gap: 8, marginBottom: hasConversation ? 0 : 16 }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Digite o que procura ou faça uma pergunta"
          aria-label="Mensagem para o assistente de compras"
          style={{
            flex: 1,
            padding: "14px 18px",
            borderRadius: 14,
            border: `1.5px solid ${palette.gray200}`,
            fontSize: 15,
          }}
        />
        <button type="submit" className="cta-primary" disabled={loading} style={{ padding: "0 24px" }}>
          {loading ? "..." : "➤"}
        </button>
      </form>

      {!hasConversation && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 16 }}>
          {SUGESTOES_INICIAIS.map((s) => (
            <button key={s} type="button" onClick={() => sendMessage(s)} className="cat-btn" disabled={loading}>
              {s}
            </button>
          ))}
        </div>
      )}

      {error && <p style={{ color: "#B42318", fontSize: 14, textAlign: "center", marginTop: 16 }}>{error}</p>}

      {products.length > 0 && (
        <div
          className="products-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: 16,
            marginTop: 24,
          }}
        >
          {products.map((product: CatalogProduct) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </section>
  );
}
```

Principais diferenças em relação ao arquivo atual:
- Removidos os estados `reply` (string) e `lastUserMessage` (string) — a bolha de cada mensagem vem direto de `messages`.
- Adicionados `bottomRef` (`useRef<HTMLDivElement>`) e um `useEffect` que rola a conversa para o final a cada mudança em `messages` ou `loading`.
- Novo bloco de conversa (`hasConversation && (...)`) com uma `div` rolável (`maxHeight: 360`, `overflowY: "auto"`) contendo uma bolha por mensagem e, se `loading`, uma bolha "Digitando…".
- Os chips de `SUGESTOES_INICIAIS` só renderizam quando `!hasConversation` (antes ficavam sempre visíveis).
- O `<form>` do input saiu de cima e passou para depois do bloco de conversa/chips de perfil.
- Chips de `profileOptions`, mensagem de `error` e grid de produtos mantêm a mesma lógica de condição de hoje, só reordenados conforme a spec.

- [ ] **Step 3: Type-check do pacote**

Rode:
```bash
cd c:/Projetos/mypet-landing && npx tsc --noEmit -p packages/core/tsconfig.json
```
Esperado: nenhum erro (saída vazia, exit code 0). Se aparecer erro de tipo, corrija antes de prosseguir — não ignore com `any`/`@ts-ignore`.

- [ ] **Step 4: Rodar a suíte de testes do pacote `core`**

Rode:
```bash
cd c:/Projetos/mypet-landing && pnpm test
```
Esperado: todos os testes continuam passando (59 testes hoje — nenhum deles cobre `assistant-search.tsx`, então a contagem não deve mudar). Isso confirma que a refatoração não quebrou nada em `assistant-client.ts`/`catalog.ts`/etc. que outros arquivos dependam.

- [ ] **Step 5: Rodar lint**

Rode:
```bash
cd c:/Projetos/mypet-landing && pnpm lint
```
Esperado: sem erros novos no arquivo modificado.

- [ ] **Step 6: Verificação manual no navegador (use a skill `/run` ou suba `pnpm dev:mypet` manualmente)**

Suba o app (`pnpm dev:mypet`), abra a home no navegador e, na caixa "O que você está procurando hoje?", confirme cada item:

1. Estado vazio: input + os 3 chips de sugestão inicial aparecem, sem área de conversa.
2. Clique num chip (ex.: "Buscar ração para filhotes") ou digite e envie: o chip some, aparece uma bolha alinhada à direita com a sua mensagem, depois uma bolha "Digitando…" alinhada à esquerda enquanto carrega, substituída pela resposta da IA quando chega.
3. Envie uma segunda mensagem digitando no input (que agora fica logo abaixo da conversa): confirme que a bolha da primeira troca continua visível acima, e a nova troca aparece abaixo, com scroll automático mantendo a mensagem mais recente visível.
4. Se a resposta pedir confirmação de perfil (mensagem ambígua, ex.: "oi"), confirme que os chips de opções aparecem entre a conversa e o input, e que clicar num deles envia como nova mensagem.
5. Se a resposta trouxer produtos, confirme que o grid aparece fixo abaixo do input/erro, com os cards normais.
6. Force um erro (ex.: pare o servidor de IA ou desconecte a rede momentaneamente) e confirme que a mensagem de erro aparece abaixo do input, sem quebrar a conversa já exibida.

Se algum item falhar, volte ao Step 2 e ajuste antes de prosseguir.

- [ ] **Step 7: Commit**

```bash
cd c:/Projetos/mypet-landing
git add packages/core/src/components/assistant-search.tsx
git commit -m "$(cat <<'EOF'
feat: assistente de busca vira chat continuo com input fixo abaixo da conversa

EOF
)"
```
