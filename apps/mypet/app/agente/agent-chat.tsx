"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  messageText,
  productsFromMessage,
  useAgentChat,
  useAgentConversation,
  type AgentMessage,
  type StoredConversation,
} from "@mypet/core/agent-client";
import { useCart } from "@mypet/core/components/cart-provider";
import { PRICE_LOCK_REASON, ProductCards } from "./product-cards";

export type AgentPageMode = "visitante" | "cliente";

type AgentChatProps = {
  mode: AgentPageMode;
  initialQuestion: string | null;
  onInitialQuestionUsed: () => void;
  onLockedIntent: (reason: string) => void;
};

type Intent = { label: string; question: string };
type LockedIntent = { label: string; reason: string };

const SHARED_INTENTS: Intent[] = [
  { label: "Frete e prazos de entrega", question: "Como funciona o frete e qual o prazo de entrega?" },
  { label: "Pagamento e pedido mínimo", question: "Quais são as formas de pagamento e o pedido mínimo?" },
];

const VISITOR_INTENTS: Intent[] = [
  { label: "Encontrar produtos", question: "Quais produtos vocês têm para o meu pet shop?" },
  ...SHARED_INTENTS,
];

const CLIENT_INTENTS: Intent[] = [
  { label: "Encontrar produtos e preços", question: "Quero ver produtos e preços." },
  ...SHARED_INTENTS,
];

const LOCKED_INTENTS: LockedIntent[] = [
  { label: "Ver preços", reason: PRICE_LOCK_REASON },
  { label: "Montar meu pedido", reason: "Cadastre-se para montar seu pedido conversando com o agente." },
  { label: "Acompanhar meus pedidos", reason: "Cadastre-se para acompanhar seus pedidos por aqui." },
];

// Caminhos internos citados pelo agente viram links.
const LINK_PATTERN =
  /(?<![\w/.])(\/(?:central-de-ajuda(?:\/[a-z0-9-]+)*|cadastro|perguntas-frequentes|pedido-rapido|pedidos))(?![\w-])/g;

function renderWithLinks(text: string) {
  return text.split(LINK_PATTERN).map((part, i) =>
    i % 2 === 1 ? (
      <a key={i} href={part}>
        {part}
      </a>
    ) : (
      part
    ),
  );
}

export function AgentChat(props: AgentChatProps) {
  const { conversation, reset, notice, clearNotice } = useAgentConversation();
  if (!conversation) {
    return (
      <section className="ag-chat" aria-labelledby="ag-chat-title" aria-busy="true">
        <ChatHead />
      </section>
    );
  }
  return <AgentChatSession key={conversation.id} conversation={conversation} onReset={reset} notice={notice} onNoticeClear={clearNotice} {...props} />;
}

function ChatHead() {
  return (
    <header className="ag-chat-head">
      <span className="ag-spark" aria-hidden>
        ✦
      </span>
      <h1 id="ag-chat-title">Agente My Pet</h1>
    </header>
  );
}

function AgentChatSession({
  conversation,
  onReset,
  notice,
  onNoticeClear,
  mode,
  initialQuestion,
  onInitialQuestionUsed,
  onLockedIntent,
}: AgentChatProps & {
  conversation: StoredConversation;
  onReset: (notice?: string) => void;
  notice: string | null;
  onNoticeClear: () => void;
}) {
  const { cart } = useCart();
  const { messages, sendText: send, busy, error } = useAgentChat({
    conversation,
    getCart: () => cart.items.map((item) => ({ id: item.id, name: item.name, qty: item.qty, unitPrice: item.unitPrice ?? null })),
    onConversationReset: onReset,
  });
  // pergunta aceita: o aviso de "conversa nova" já cumpriu o papel
  const sendText = useCallback(
    (text: string) => {
      const accepted = send(text);
      if (accepted) onNoticeClear();
      return accepted;
    },
    [send, onNoticeClear],
  );
  const [input, setInput] = useState("");
  const logRef = useRef<HTMLDivElement>(null);
  // StrictMode roda efeitos duas vezes em desenvolvimento: a ref evita enviar
  // a pergunta inicial em dobro.
  const sentInitial = useRef(false);

  useEffect(() => {
    if (!initialQuestion || sentInitial.current) return;
    // se o envio for recusado (ex.: ocupado), a pergunta continua pendente e o
    // efeito tenta de novo quando o sendText mudar
    if (!sendText(initialQuestion)) return;
    sentInitial.current = true;
    onInitialQuestionUsed();
    // a pergunta já foi enviada: tira o ?pergunta= da URL
    const url = new URL(window.location.href);
    url.searchParams.delete("pergunta");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, [initialQuestion, onInitialQuestionUsed, sendText]);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, busy]);

  const intents = mode === "cliente" ? CLIENT_INTENTS : VISITOR_INTENTS;
  const waiting = busy && messages[messages.length - 1]?.role === "user";

  return (
    <section className="ag-chat" aria-labelledby="ag-chat-title">
      <ChatHead />
      <div
        ref={logRef}
        className="ag-log"
        {...(messages.length > 0 ? { role: "log", "aria-live": "polite", "aria-relevant": "additions" } : {})}
      >
        {notice && (
          <p className="ag-notice" role="status">
            {notice}
          </p>
        )}
        {messages.length === 0 ? (
          <div className="ag-welcome">
            <h2>Como posso te ajudar hoje?</h2>
            <p>
              {mode === "cliente"
                ? "Encontre produtos, confira preços e tire dúvidas sobre pedido, entrega e pagamento."
                : "Tire dúvidas sobre pedido, entrega e pagamento ou encontre produtos da tabela."}
            </p>
            <ul className="ag-intents">
              {intents.map((intent) => (
                <li key={intent.label}>
                  <button type="button" className="ag-intent" disabled={busy} onClick={() => sendText(intent.question)}>
                    <span>{intent.label}</span>
                    <span aria-hidden>›</span>
                  </button>
                </li>
              ))}
            </ul>
            {mode === "visitante" && (
              <>
                <p className="ag-intents-sep">Exclusivo para cadastrados</p>
                <ul className="ag-intents">
                  {LOCKED_INTENTS.map((intent) => (
                    <li key={intent.label}>
                      <button
                        type="button"
                        className="ag-intent ag-intent--locked"
                        onClick={() => onLockedIntent(intent.reason)}
                      >
                        <span>
                          <span aria-hidden>🔒 </span>
                          {intent.label}
                        </span>
                        <span aria-hidden>›</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        ) : (
          messages.map((message) => (
            <MessageView key={message.id} message={message} mode={mode} onLockedIntent={onLockedIntent} />
          ))
        )}
        {waiting && <p className="ag-msg ag-msg--muted">Pensando…</p>}
      </div>

      {error && (
        <p className="ag-error" role="alert">
          {error.message}
        </p>
      )}

      <form
        className="ag-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (sendText(input)) setInput("");
        }}
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Pergunte qualquer coisa sobre a My Pet Brasil…"
          aria-label="Sua pergunta"
          maxLength={500}
        />
        <button type="submit" aria-label="Enviar" disabled={busy || !input.trim()}>
          ↑
        </button>
      </form>
      <p className="ag-disclaimer">Respostas automáticas podem conter erros.</p>
    </section>
  );
}

function MessageView({
  message,
  mode,
  onLockedIntent,
}: {
  message: AgentMessage;
  mode: AgentPageMode;
  onLockedIntent: (reason: string) => void;
}) {
  const text = messageText(message);
  if (message.role === "user") return <p className="ag-msg ag-msg--user">{text}</p>;
  const products = productsFromMessage(message);
  return (
    <div className="ag-turn">
      {text && <p className="ag-msg">{renderWithLinks(text)}</p>}
      {products.length > 0 && <ProductCards products={products} mode={mode} onLockedIntent={onLockedIntent} />}
    </div>
  );
}
