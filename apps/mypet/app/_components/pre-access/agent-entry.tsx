"use client";

import { useState } from "react";

export function AgentEntry() {
  const [text, setText] = useState("");

  return (
    <form
      className="pa-ai"
      aria-labelledby="pa-agent-title"
      onSubmit={(event) => {
        event.preventDefault();
        const question = text.trim();
        window.location.assign(question ? `/agente?pergunta=${encodeURIComponent(question)}` : "/agente");
      }}
    >
      <h3 id="pa-agent-title" className="pa-ai-title">
        Não achou sua dúvida? Pergunte ao agente My Pet
      </h3>
      <p className="pa-ai-lead">Ele responde sobre pedido, entrega e pagamento e mostra os produtos da tabela.</p>
      <div className="pa-ai-form">
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Ex.: vocês têm shampoo neutro?"
          aria-label="Sua pergunta para o agente"
          maxLength={500}
        />
        <button type="submit" className="pa-btn pa-btn-primary">
          Perguntar
        </button>
      </div>
    </form>
  );
}
