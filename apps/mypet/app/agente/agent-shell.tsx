"use client";

import { useCallback, useState } from "react";
import { clientConfig } from "@/client.config";
import { AgentChat, type AgentPageMode } from "./agent-chat";
import { AccessPanel } from "./access-panel";

const { name: SITE_NAME, logo } = clientConfig;

export function AgentShell({ mode, initialQuestion }: { mode: AgentPageMode; initialQuestion: string | null }) {
  const [question, setQuestion] = useState(initialQuestion);
  const [reason, setReason] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const isVisitor = mode === "visitante";

  const handleQuestionUsed = useCallback(() => setQuestion(null), []);
  const handleLocked = useCallback((nextReason: string) => {
    setReason(nextReason);
    setSheetOpen(true);
    // no computador o painel já está visível: leva o foco ao primeiro campo
    requestAnimationFrame(() => document.getElementById("pa-cnpj")?.focus());
  }, []);

  return (
    <div className="ag-page">
      <header className="pa-header">
        <div className="pa-wrap pa-header-row">
          <a href="/" className="pa-brand" style={{ textDecoration: "none" }}>
            <span aria-hidden>{logo.emoji}</span>
            <span>{SITE_NAME}</span>
          </a>
          <nav className="ag-header-links" aria-label="Navegação">
            {isVisitor ? (
              <a href="/" className="ag-hide-mobile">
                Voltar para a home
              </a>
            ) : (
              <>
                <a href="/pedido-rapido">Tabela de preços</a>
                <a href="/pedidos">Meus pedidos</a>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className={isVisitor ? "ag-main ag-main--split" : "ag-main"}>
        <AgentChat
          mode={mode}
          initialQuestion={question}
          onInitialQuestionUsed={handleQuestionUsed}
          onLockedIntent={handleLocked}
        />
        {isVisitor && <AccessPanel reason={reason} open={sheetOpen} onClose={() => setSheetOpen(false)} />}
      </main>

      {isVisitor && !sheetOpen && (
        <button type="button" className="ag-unlock-bar" onClick={() => setSheetOpen(true)}>
          Liberar acesso completo
        </button>
      )}

      <footer className="ag-footer">
        As conversas com o agente são guardadas para melhorar o atendimento. Dados de CNPJ e WhatsApp usados apenas
        para liberar a tabela de preços.
      </footer>
    </div>
  );
}
