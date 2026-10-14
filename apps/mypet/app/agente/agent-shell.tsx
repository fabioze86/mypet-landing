"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { clientConfig } from "@/client.config";
import { AgentChat, type AgentPageMode } from "./agent-chat";
import { AccessPanel } from "./access-panel";

const { name: SITE_NAME, logo } = clientConfig;

// SSR-safe: false até montar no navegador
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(max-width: 900px)");
    const update = () => setIsMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return isMobile;
}

export function AgentShell({ mode, initialQuestion }: { mode: AgentPageMode; initialQuestion: string | null }) {
  const [question, setQuestion] = useState(initialQuestion);
  const [reason, setReason] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const isVisitor = mode === "visitante";
  const isMobile = useIsMobile();
  const modal = isVisitor && isMobile && sheetOpen;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const barRef = useRef<HTMLButtonElement>(null);
  const wasModal = useRef(false);

  useEffect(() => {
    if (wasModal.current && !modal) barRef.current?.focus();
    wasModal.current = modal;
  }, [modal]);

  const handleQuestionUsed = useCallback(() => setQuestion(null), []);
  const handleClose = useCallback(() => setSheetOpen(false), []);
  const handleLocked = useCallback(
    (nextReason: string) => {
      setReason(nextReason);
      if (isMobile) {
        setSheetOpen(true);
        return;
      }
      // no computador o painel já está visível: só leva a vista e o foco até ele
      headingRef.current?.closest("aside")?.scrollIntoView?.({ block: "nearest" });
      headingRef.current?.focus();
    },
    [isMobile],
  );

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
        <div className="ag-chat-wrap" inert={modal}>
          <AgentChat
            mode={mode}
            initialQuestion={question}
            onInitialQuestionUsed={handleQuestionUsed}
            onLockedIntent={handleLocked}
          />
        </div>
        {isVisitor && (
          <AccessPanel
            reason={reason}
            open={modal}
            modal={modal}
            onClose={handleClose}
            headingRef={headingRef}
          />
        )}
      </main>

      {isVisitor && (
        <button
          type="button"
          className="ag-unlock-bar"
          ref={barRef}
          hidden={modal}
          onClick={() => setSheetOpen(true)}
        >
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
