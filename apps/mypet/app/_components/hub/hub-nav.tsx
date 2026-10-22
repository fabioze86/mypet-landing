"use client";

import { useCart } from "@mypet/core/components/cart-provider";
import { clientConfig } from "@/client.config";
import { cadastroHref, hubDoors, type HubDoorId, type HubViewer } from "./doors";
import { HUB_STYLES } from "./styles";
import { useLogout } from "./use-logout";

const { name: SITE_NAME, logo } = clientConfig;

// Cabeçalho único do hub: as quatro portas aparecem para todos. Para o
// visitante, tabela e catálogo levam o selo "com cadastro".
export function HubNav({ viewer, current, inert }: { viewer: HubViewer; current?: HubDoorId; inert?: boolean }) {
  return (
    <header className="hub-header" inert={inert}>
      <style>{HUB_STYLES}</style>
      <div className="hub-row">
        <a href={viewer.kind === "cliente" ? "/agente" : "/"} className="hub-brand">
          <span aria-hidden>{logo.emoji}</span>
          <span className="hub-brand-name">{SITE_NAME}</span>
        </a>
        <nav className="hub-doors" aria-label="Hub My Pet">
          {hubDoors(viewer).map((door) => (
            <a
              key={door.id}
              href={door.href}
              className="hub-door"
              aria-current={door.id === current ? "page" : undefined}
            >
              {door.label}
              {door.locked && (
                <>
                  {" "}
                  <span className="hub-lock">com cadastro</span>
                </>
              )}
            </a>
          ))}
        </nav>
        {viewer.kind === "cliente" ? (
          <ClienteActions displayName={viewer.displayName} />
        ) : (
          <div className="hub-actions">
            <a href={cadastroHref("/pedido-rapido")} className="hub-cta">
              Abrir tabela
            </a>
          </div>
        )}
      </div>
    </header>
  );
}

// só o cliente usa carrinho e logout: o cabeçalho do visitante não depende do CartProvider
function ClienteActions({ displayName }: { displayName: string | null }) {
  const { cart } = useCart();
  const { logout, loggingOut, error } = useLogout();
  const count = cart.items.reduce((sum, item) => sum + item.qty, 0);
  return (
    <div className="hub-actions">
      <span className="hub-hello">{displayName ? `Olá, ${displayName}` : "Olá!"}</span>
      <a href="/pedidos">Meus pedidos</a>
      <a href="/cotacao">Seu pedido{count > 0 ? ` (${count})` : ""}</a>
      <button type="button" className="hub-logout" onClick={logout} disabled={loggingOut}>
        Sair
      </button>
      {error && (
        <p className="hub-logout-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
