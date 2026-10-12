"use client";

import { useEffect, useRef, useState } from "react";
import type { AssistantMessage } from "@mypet/core/assistant-client";
import { askSupportAssistant } from "@mypet/core/support-assistant-client";

const SUGESTOES = [
  "Qual é o pedido mínimo?",
  "Vocês entregam na minha região?",
  "Posso pagar no boleto?",
];

// Caminhos internos que o assistente pode citar na resposta viram links.
const LINK_PATTERN = /(\/(?:central-de-ajuda(?:\/[a-z0-9-]+)*|cadastro|perguntas-frequentes))/g;

function renderReply(text: string) {
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

export function FaqAssistant({ channel }: { channel: string }) {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, loading]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const next: AssistantMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setError(null);
    setLoading(true);

    const result = await askSupportAssistant(channel, next);
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessages([...next, { role: "assistant", content: result.reply }]);
  }

  return (
    <div className="pa-ai" role="region" aria-labelledby="pa-ai-title">
      <h3 id="pa-ai-title" className="pa-ai-title">Não achou sua dúvida? Pergunte aqui</h3>
      <p className="pa-ai-lead">Respostas automáticas com base na nossa central de ajuda.</p>

      {messages.length > 0 && (
        <div ref={logRef} className="pa-ai-log" aria-live="polite">
          {messages.map((m, i) => (
            <p key={i} className={m.role === "user" ? "pa-ai-msg pa-ai-msg--user" : "pa-ai-msg"}>
              {m.role === "assistant" ? renderReply(m.content) : m.content}
            </p>
          ))}
          {loading && <p className="pa-ai-msg pa-ai-msg--muted">Digitando…</p>}
        </div>
      )}

      <form
        className="pa-ai-form"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ex.: qual o prazo de entrega para o Nordeste?"
          aria-label="Sua dúvida"
          maxLength={500}
        />
        <button type="submit" className="pa-btn pa-btn-primary" disabled={loading}>
          {loading ? "..." : "Perguntar"}
        </button>
      </form>

      {messages.length === 0 && (
        <div className="pa-ai-chips">
          {SUGESTOES.map((s) => (
            <button key={s} type="button" onClick={() => send(s)} disabled={loading}>
              {s}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p className="pa-ai-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
