import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

vi.mock("./agent-chat", async () => {
  const { useEffect } = await import("react");
  return {
    AgentChat: ({
      onLockedIntent,
      onConversationChange,
    }: {
      onLockedIntent: (reason: string) => void;
      onConversationChange?: (id: string) => void;
    }) => {
      useEffect(() => onConversationChange?.("conv-1"), [onConversationChange]);
      return (
        <button type="button" onClick={() => onLockedIntent("Cadastre-se para ver os preços da tabela.")}>
          cadeado
        </button>
      );
    },
  };
});
vi.mock("./cart-panel", () => ({
  CartPanel: ({
    conversationId,
    headingRef,
  }: {
    conversationId: string | null;
    headingRef?: React.RefObject<HTMLHeadingElement | null>;
  }) => (
    <div>
      <h2 ref={headingRef} tabIndex={-1}>
        Seu pedido
      </h2>
      carrinho {String(conversationId)}
    </div>
  ),
}));
type ShellCartItem = { id: string; name: string; sku: string; brand: null; img: string; qty: number; unitPrice?: number };
const DEFAULT_ITEMS: ShellCartItem[] = [
  { id: "p1", name: "Shampoo", sku: "S1", brand: null, img: "/x.jpg", qty: 2, unitPrice: 10 },
  { id: "p2", name: "Condicionador", sku: "S2", brand: null, img: "/y.jpg", qty: 1, unitPrice: 5.5 },
];
const shellCart = vi.hoisted(() => ({ items: [] as ShellCartItem[], clear: vi.fn() }));
vi.mock("@mypet/core/components/cart-provider", () => ({
  useCart: () => ({ cart: { items: shellCart.items }, clear: shellCart.clear }),
}));
const nav = vi.hoisted(() => ({ goTo: vi.fn() }));
vi.mock("./navigate", () => ({ goTo: nav.goTo }));
vi.mock("../_components/pre-access/access-form", () => ({
  AccessForm: ({ redirectTo }: { redirectTo?: string }) => <form aria-label={`cadastro ${redirectTo}`} />,
}));

import { AgentShell } from "./agent-shell";

let mediaListeners: Array<() => void> = [];
let mobileNow = false;

function mockViewport(mobile: boolean) {
  mobileNow = mobile;
  mediaListeners = [];
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation(() => ({
      get matches() {
        return mobileNow;
      },
      addEventListener: (_: string, fn: () => void) => mediaListeners.push(fn),
      removeEventListener: (_: string, fn: () => void) => {
        mediaListeners = mediaListeners.filter((l) => l !== fn);
      },
    })),
  );
}

beforeEach(() => {
  mockViewport(false);
  shellCart.items = DEFAULT_ITEMS;
  shellCart.clear.mockClear();
  nav.goTo.mockClear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.style.overflow = "";
});

describe("AgentShell", () => {
  it("visitante: painel de acesso com cadastro que volta para /agente", () => {
    render(<AgentShell mode="visitante" initialQuestion={null} displayName={null} />);
    expect(screen.getByRole("heading", { name: "Acesso completo ao agente" })).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "cadastro /agente" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Liberar acesso completo" })).toBeInTheDocument();
  });

  it("computador: cadeado mostra o motivo, sem diálogo, e leva o foco ao título", () => {
    render(<AgentShell mode="visitante" initialQuestion={null} displayName={null} />);
    fireEvent.click(screen.getByRole("button", { name: "cadeado" }));
    expect(screen.getByRole("status")).toHaveTextContent("Cadastre-se para ver os preços da tabela.");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("heading", { name: "Acesso completo ao agente" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "Liberar acesso completo" })).toBeVisible();
  });

  it("celular: a barra abre o diálogo, Esc fecha e devolve o foco à barra", () => {
    mockViewport(true);
    render(<AgentShell mode="visitante" initialQuestion={null} displayName={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Liberar acesso completo" }));
    const dialog = screen.getByRole("dialog", { name: "Acesso completo ao agente" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("heading", { name: "Acesso completo ao agente" })).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.style.overflow).toBe("");
    const bar = screen.getByRole("button", { name: "Liberar acesso completo" });
    expect(bar).toBeVisible();
    expect(bar).toHaveFocus();
  });

  it("celular: cadeado abre o diálogo com o motivo e o botão Fechar fecha", () => {
    mockViewport(true);
    render(<AgentShell mode="visitante" initialQuestion={null} displayName={null} />);
    fireEvent.click(screen.getByRole("button", { name: "cadeado" }));
    expect(screen.getByRole("dialog", { name: "Acesso completo ao agente" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Cadastre-se para ver os preços da tabela.");
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("celular: com o painel aberto, cabeçalho, chat e rodapé ficam inert", () => {
    mockViewport(true);
    const { container } = render(<AgentShell mode="visitante" initialQuestion={null} displayName={null} />);
    const regions = () => [
      container.querySelector("header.pa-header"),
      container.querySelector(".ag-chat-wrap"),
      container.querySelector("footer.ag-footer"),
    ];
    for (const el of regions()) expect(el).not.toHaveAttribute("inert");
    fireEvent.click(screen.getByRole("button", { name: "Liberar acesso completo" }));
    for (const el of regions()) expect(el).toHaveAttribute("inert");
    fireEvent.keyDown(document, { key: "Escape" });
    for (const el of regions()) expect(el).not.toHaveAttribute("inert");
  });

  it("painel aberto no celular fecha ao virar tela de computador", () => {
    mockViewport(true);
    render(<AgentShell mode="visitante" initialQuestion={null} displayName={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Liberar acesso completo" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    act(() => {
      mobileNow = false;
      mediaListeners.forEach((fn) => fn());
    });
    expect(screen.queryByRole("dialog")).toBeNull();

    // voltar ao celular não reabre o painel sozinho
    act(() => {
      mobileNow = true;
      mediaListeners.forEach((fn) => fn());
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("cliente: sem painel de acesso, com links da tabela e dos pedidos", () => {
    render(<AgentShell mode="cliente" initialQuestion={null} displayName={null} />);
    expect(screen.queryByRole("heading", { name: "Acesso completo ao agente" })).toBeNull();
    expect(screen.getByRole("link", { name: "Tabela de preços" })).toHaveAttribute("href", "/pedido-rapido");
    expect(screen.getByRole("link", { name: "Meus pedidos" })).toHaveAttribute("href", "/pedidos");
  });

  it("cliente (computador): carrinho ao lado com o id da conversa, sem painel de acesso", () => {
    render(<AgentShell mode="cliente" initialQuestion={null} displayName={null} />);
    expect(screen.getByText(/carrinho conv-1/)).toBeInTheDocument();
    expect(screen.queryByText("Acesso completo ao agente")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("cliente (celular): a barra abre o diálogo Seu pedido, Esc fecha e devolve o foco à barra", () => {
    mockViewport(true);
    const { container } = render(<AgentShell mode="cliente" initialQuestion={null} displayName={null} />);
    const bar = screen.getByRole("button", { name: /Ver seu pedido · 3 itens · R\$\s?25,50/ });
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(bar);

    const dialog = screen.getByRole("dialog", { name: "Seu pedido" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("heading", { name: "Seu pedido" })).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");
    expect(container.querySelector(".ag-chat-wrap")).toHaveAttribute("inert");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.style.overflow).toBe("");
    expect(container.querySelector(".ag-chat-wrap")).not.toHaveAttribute("inert");
    const again = screen.getByRole("button", { name: /Ver seu pedido/ });
    expect(again).toBeVisible();
    expect(again).toHaveFocus();
  });

  it("cliente (celular): o botão Fechar fecha o diálogo Seu pedido", () => {
    mockViewport(true);
    render(<AgentShell mode="cliente" initialQuestion={null} displayName={null} />);
    fireEvent.click(screen.getByRole("button", { name: /Ver seu pedido/ }));
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("cliente (celular): barra indica itens sem preço no total", () => {
    mockViewport(true);
    shellCart.items = [...DEFAULT_ITEMS, { id: "p3", name: "Escova", sku: "S3", brand: null, img: "/z.jpg", qty: 1 }];
    render(<AgentShell mode="cliente" initialQuestion={null} displayName={null} />);
    expect(
      screen.getByRole("button", { name: /^Ver seu pedido · 4 itens · R\$\s?25,50 \+ itens sem preço$/ }),
    ).toBeInTheDocument();
  });

  it("cliente (celular): barra sem itens sem preço não mostra o aviso", () => {
    mockViewport(true);
    render(<AgentShell mode="cliente" initialQuestion={null} displayName={null} />);
    expect(screen.getByRole("button", { name: /Ver seu pedido/ }).textContent).not.toContain("sem preço");
  });

  it("cliente: intenção com cadeado não abre painel nem move o foco", () => {
    mockViewport(true);
    render(<AgentShell mode="cliente" initialQuestion={null} displayName={null} />);
    const lock = screen.getByRole("button", { name: "cadeado" });
    lock.focus();
    fireEvent.click(lock);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(lock).toHaveFocus();
  });

  it("rodapé informa que as conversas são guardadas", () => {
    render(<AgentShell mode="visitante" initialQuestion={null} displayName={null} />);
    expect(screen.getByText(/conversas com o agente são guardadas/)).toBeInTheDocument();
  });

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
    window.localStorage.setItem("mypet_agente_lead", "{}");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<AgentShell mode="cliente" initialQuestion={null} displayName="Ana" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Sair" }));
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/sair", expect.objectContaining({ method: "POST" }));
    expect(shellCart.clear).toHaveBeenCalled();
    expect(window.sessionStorage.getItem("mypet-agente-conversa")).toBeNull();
    expect(window.localStorage.getItem("mypet_agente_lead")).toBeNull();
    expect(nav.goTo).toHaveBeenCalledWith("/");
  });

  it("Sair com falha: mostra erro e não limpa nada", async () => {
    mockViewport(false);
    window.localStorage.setItem("mypet_agente_lead", "{}");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })));
    render(<AgentShell mode="cliente" initialQuestion={null} displayName="Ana" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Sair" }));
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível sair agora. Tente de novo.");
    expect(shellCart.clear).not.toHaveBeenCalled();
    expect(window.localStorage.getItem("mypet_agente_lead")).toBe("{}");
    expect(nav.goTo).not.toHaveBeenCalled();
  });
});
