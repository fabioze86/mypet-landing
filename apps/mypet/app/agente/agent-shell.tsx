"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { formatBRL } from "@mypet/core/catalog-utils";
import { useCart } from "@mypet/core/components/cart-provider";
import { AGENT_LEAD_STORAGE_KEY, AGENT_STORAGE_KEY } from "@mypet/core/agent-client";
import { clientConfig } from "@/client.config";
import { AgentChat, type AgentPageMode } from "./agent-chat";
import { AccessPanel } from "./access-panel";
import { CartPanel } from "./cart-panel";
import { goTo } from "./navigate";
import { useSheetDialog } from "./use-sheet-dialog";

const { name: SITE_NAME, logo } = clientConfig;

const LOGOUT_ERROR = "Não foi possível sair agora. Tente de novo.";

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

// Barra fixa do celular (modo cliente) com o resumo do pedido; abre o painel "Seu pedido".
function CartBar({
  barRef,
  hidden,
  onOpen,
}: {
  barRef: RefObject<HTMLButtonElement | null>;
  hidden: boolean;
  onOpen: () => void;
}) {
  const { cart } = useCart();
  const count = cart.items.reduce((sum, item) => sum + item.qty, 0);
  const total = cart.items.reduce((sum, item) => sum + (item.unitPrice ?? 0) * item.qty, 0);
  // mesma regra do painel: o total não inclui itens sem preço, então avisa
  const hasUnpriced = cart.items.some((item) => item.unitPrice == null);
  return (
    <button type="button" className="ag-unlock-bar ag-cart-bar" ref={barRef} hidden={hidden} onClick={onOpen}>
      Ver seu pedido · {count} {count === 1 ? "item" : "itens"} · {formatBRL(total)}
      {hasUnpriced && " + itens sem preço"}
    </button>
  );
}

export function AgentShell({
  mode,
  initialQuestion,
  displayName,
}: {
  mode: AgentPageMode;
  initialQuestion: string | null;
  displayName: string | null;
}) {
  const [question, setQuestion] = useState(initialQuestion);
  const [reason, setReason] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
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
    try {
      // o lead é dado pessoal: sair apaga o nome e o WhatsApp deste navegador
      window.localStorage.removeItem(AGENT_LEAD_STORAGE_KEY);
    } catch {
      // storage bloqueado: nada guardado para apagar
    }
    goTo("/");
  }, [clearCart]);
  const isVisitor = mode === "visitante";
  const isMobile = useIsMobile();
  // no celular o painel da direita (acesso para o visitante, "Seu pedido" para o cliente) vira diálogo
  const sheetModal = isMobile && sheetOpen;
  const modal = isVisitor && sheetModal;
  const cartModal = !isVisitor && sheetModal;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const cartHeadingRef = useRef<HTMLHeadingElement>(null);
  const barRef = useRef<HTMLButtonElement>(null);
  const wasModal = useRef(false);

  useEffect(() => {
    if (wasModal.current && !sheetModal) barRef.current?.focus();
    wasModal.current = sheetModal;
  }, [sheetModal]);

  // virou tela de computador com o painel aberto: fecha, para não reabrir sozinho ao voltar ao celular
  useEffect(() => {
    if (!isMobile) setSheetOpen(false);
  }, [isMobile]);

  const handleQuestionUsed = useCallback(() => setQuestion(null), []);
  const handleClose = useCallback(() => setSheetOpen(false), []);
  const handleOpen = useCallback(() => setSheetOpen(true), []);
  useSheetDialog({ active: cartModal, onClose: handleClose, focusRef: cartHeadingRef });
  const handleLocked = useCallback(
    (nextReason: string) => {
      // intenções com cadeado só existem para o visitante
      if (!isVisitor) return;
      setReason(nextReason);
      if (isMobile) {
        setSheetOpen(true);
        return;
      }
      // no computador o painel já está visível: só leva a vista e o foco até ele
      headingRef.current?.closest("aside")?.scrollIntoView?.({ block: "nearest" });
      headingRef.current?.focus();
    },
    [isMobile, isVisitor],
  );

  return (
    <div className="ag-page">
      <header className="pa-header" inert={sheetModal}>
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
                <span className="ag-hello">{displayName ? `Olá, ${displayName}` : "Olá!"}</span>
                <a href="/pedido-rapido">Tabela de preços</a>
                <a href="/pedidos">Meus pedidos</a>
                <button type="button" className="ag-logout" onClick={handleLogout} disabled={loggingOut}>
                  Sair
                </button>
              </>
            )}
          </nav>
        </div>
        {logoutError && (
          <p className="ag-logout-error" role="alert">
            {logoutError}
          </p>
        )}
      </header>

      <main className="ag-main ag-main--split">
        <div className="ag-chat-wrap" inert={sheetModal}>
          <AgentChat
            mode={mode}
            displayName={displayName}
            initialQuestion={question}
            onInitialQuestionUsed={handleQuestionUsed}
            onLockedIntent={handleLocked}
            onConversationChange={setConversationId}
          />
        </div>
        {isVisitor ? (
          <AccessPanel
            reason={reason}
            open={modal}
            modal={modal}
            onClose={handleClose}
            headingRef={headingRef}
          />
        ) : (
          <aside
            className={cartModal ? "ag-cart-aside is-open" : "ag-cart-aside"}
            aria-label="Seu pedido"
            {...(cartModal ? { role: "dialog", "aria-modal": true } : {})}
          >
            <button type="button" className="ag-access-close" onClick={handleClose} aria-label="Fechar">
              ×
            </button>
            <CartPanel conversationId={conversationId} headingRef={cartHeadingRef} />
          </aside>
        )}
      </main>

      {isVisitor ? (
        <button type="button" className="ag-unlock-bar" ref={barRef} hidden={modal} onClick={handleOpen}>
          Liberar acesso completo
        </button>
      ) : (
        <CartBar barRef={barRef} hidden={cartModal} onOpen={handleOpen} />
      )}

      <footer className="ag-footer" inert={sheetModal}>
        As conversas com o agente são guardadas para melhorar o atendimento. Dados de CNPJ e WhatsApp usados apenas
        para liberar a tabela de preços.
      </footer>
    </div>
  );
}
