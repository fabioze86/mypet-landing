"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  LEAD_NAME_MAX,
  LEAD_WHATSAPP_MAX,
  cartChangesFromMessage,
  messageText,
  normalizeAgentLead,
  productsFromMessage,
  useAgentChat,
  useAgentConversation,
  useAgentLead,
  type AgentLead,
  type AgentMessage,
  type AgentProduct,
  type StoredConversation,
} from "@mypet/core/agent-client";
import { useCart } from "@mypet/core/components/cart-provider";
import { applyCartChanges } from "./cart-sync";
import { PRICE_LOCK_REASON, ProductCards, productDisplayName } from "./product-cards";

export type AgentPageMode = "visitante" | "cliente";

type AgentChatProps = {
  mode: AgentPageMode;
  initialQuestion: string | null;
  onInitialQuestionUsed: () => void;
  onLockedIntent: (reason: string) => void;
  onConversationChange?: (id: string) => void;
  // nome de exibição do cliente logado (cadastro: nome, senão empresa)
  displayName?: string | null;
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
  { label: "Montar um pedido", question: "Quero montar um pedido." },
  { label: "O que preciso repor?", question: "O que eu preciso repor?" },
  { label: "Status dos meus pedidos", question: "Como estão os meus pedidos?" },
  SHARED_INTENTS[0],
];

const LOCKED_INTENTS: LockedIntent[] = [
  { label: "Ver preços", reason: PRICE_LOCK_REASON },
  { label: "Montar meu pedido", reason: "Cadastre-se para montar seu pedido conversando com o agente." },
  { label: "Acompanhar meus pedidos", reason: "Cadastre-se para acompanhar seus pedidos por aqui." },
];

const LEAD_ASK_NAME = "Antes de prosseguir, preciso de duas informações: 1 - Qual é o seu nome?";
const LEAD_ASK_WHATSAPP = "2 - Deseja informar um WhatsApp?";
const DEFAULT_GREETING = "Como posso te ajudar hoje?";

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
  onConversationChange,
  displayName,
}: AgentChatProps & {
  conversation: StoredConversation;
  onReset: (notice?: string) => void;
  notice: string | null;
  onNoticeClear: () => void;
}) {
  const { cart, addItem, setLine } = useCart();
  // Roteiro fixo do visitante (sem IA): nome e WhatsApp antes da primeira pergunta.
  const { lead, ready: leadReady, saveLead } = useAgentLead();
  const isVisitor = mode === "visitante";
  const leadRef = useRef(lead);
  leadRef.current = lead;
  const [nomeAnswer, setNomeAnswer] = useState<string | null>(null);
  const [completedLead, setCompletedLead] = useState<AgentLead | null>(null);
  const needsLead = isVisitor && leadReady && !lead;
  const leadPending = isVisitor && !lead;
  // carrinho mais recente para aplicar as alterações do agente ao fim da resposta
  const cartRef = useRef(cart);
  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);
  const { messages, sendText: send, busy, error } = useAgentChat({
    conversation,
    getCart: () => cart.items.map((item) => ({ id: item.id, name: item.name, qty: item.qty, unitPrice: item.unitPrice ?? null })),
    getLead: () => (isVisitor ? leadRef.current : null),
    onConversationReset: onReset,
    // só mensagens novas do agente passam por aqui: as restauradas da sessão não são reaplicadas
    onAssistantMessage: (message) => {
      if (mode !== "cliente") return;
      applyCartChanges(cartChangesFromMessage(message), { items: cartRef.current.items, setLine });
    },
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
  const handleAdd = useCallback(
    (p: AgentProduct) =>
      addItem(
        { id: p.id, name: productDisplayName(p), sku: p.sku, brand: p.brand, img: p.img, unitPrice: p.unitPrice ?? undefined },
        1,
      ),
    [addItem],
  );
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
  const [input, setInput] = useState("");
  const logRef = useRef<HTMLDivElement>(null);
  // StrictMode roda efeitos duas vezes em desenvolvimento: a ref evita enviar
  // a pergunta inicial em dobro.
  const sentInitial = useRef(false);

  useEffect(() => {
    if (!initialQuestion || sentInitial.current) return;
    // visitante responde o roteiro antes; a pergunta espera
    if (leadPending) return;
    // se o envio for recusado (ex.: ocupado), a pergunta continua pendente e o
    // efeito tenta de novo quando o sendText mudar
    if (!sendText(initialQuestion)) return;
    sentInitial.current = true;
    onInitialQuestionUsed();
    // a pergunta já foi enviada: tira o ?pergunta= da URL
    const url = new URL(window.location.href);
    url.searchParams.delete("pergunta");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, [initialQuestion, leadPending, onInitialQuestionUsed, sendText]);

  useEffect(() => {
    onConversationChange?.(conversation.id);
  }, [conversation.id, onConversationChange]);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
    // o roteiro do visitante também cresce o log: mantém a pergunta atual à vista
  }, [messages, busy, nomeAnswer, completedLead, needsLead]);

  const intents = mode === "cliente" ? CLIENT_INTENTS : VISITOR_INTENTS;
  const greetingName = isVisitor ? (completedLead ?? lead)?.nome : displayName;
  const greeting = greetingName
    ? `${completedLead ? "Obrigado" : "Olá"}, ${greetingName}! ${DEFAULT_GREETING}`
    : DEFAULT_GREETING;
  const showWelcome = messages.length === 0 && !leadPending;
  const waiting = busy && messages[messages.length - 1]?.role === "user";

  const scriptNode =
    needsLead || completedLead ? (
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
    ) : null;

  return (
    <section className="ag-chat" aria-labelledby="ag-chat-title">
      <ChatHead />
      <div
        ref={logRef}
        className="ag-log"
        {...(messages.length > 0 || needsLead || completedLead ? { role: "log", "aria-live": "polite", "aria-relevant": "additions" } : {})}
      >
        {notice && (
          <p className="ag-notice" role="status">
            {notice}
          </p>
        )}
        {messages.length === 0 && scriptNode}
        {showWelcome ? (
          <div className="ag-welcome">
            <h2>{greeting}</h2>
            <p>
              {mode === "cliente"
                ? "Monte seu pedido conversando, veja o que repor e acompanhe seus pedidos."
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
            <MessageView
              key={message.id}
              message={message}
              mode={mode}
              onLockedIntent={onLockedIntent}
              onAdd={mode === "cliente" ? handleAdd : undefined}
            />
          ))
        )}
        {messages.length > 0 && scriptNode}
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
          aria-label={needsLead ? (nomeAnswer === null ? "Qual é o seu nome?" : "Deseja informar um WhatsApp?") : "Sua pergunta"}
          maxLength={needsLead ? (nomeAnswer === null ? LEAD_NAME_MAX : LEAD_WHATSAPP_MAX) : 500}
        />
        <button type="submit" aria-label="Enviar" disabled={busy || !input.trim() || (isVisitor && !leadReady)}>
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
  onAdd,
}: {
  message: AgentMessage;
  mode: AgentPageMode;
  onLockedIntent: (reason: string) => void;
  onAdd?: (product: AgentProduct) => void;
}) {
  const text = messageText(message);
  if (message.role === "user") return <p className="ag-msg ag-msg--user">{text}</p>;
  const products = productsFromMessage(message);
  return (
    <div className="ag-turn">
      {text && <p className="ag-msg">{renderWithLinks(text)}</p>}
      {products.length > 0 && (
        <ProductCards products={products} mode={mode} onLockedIntent={onLockedIntent} onAdd={onAdd} />
      )}
    </div>
  );
}
