import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

vi.mock("./agent-chat", () => ({
  AgentChat: ({ onLockedIntent }: { onLockedIntent: (reason: string) => void }) => (
    <button type="button" onClick={() => onLockedIntent("Cadastre-se para ver os preços da tabela.")}>
      cadeado
    </button>
  ),
}));
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

beforeEach(() => mockViewport(false));
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.style.overflow = "";
});

describe("AgentShell", () => {
  it("visitante: painel de acesso com cadastro que volta para /agente", () => {
    render(<AgentShell mode="visitante" initialQuestion={null} />);
    expect(screen.getByRole("heading", { name: "Acesso completo ao agente" })).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "cadastro /agente" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Liberar acesso completo" })).toBeInTheDocument();
  });

  it("computador: cadeado mostra o motivo, sem diálogo, e leva o foco ao título", () => {
    render(<AgentShell mode="visitante" initialQuestion={null} />);
    fireEvent.click(screen.getByRole("button", { name: "cadeado" }));
    expect(screen.getByRole("status")).toHaveTextContent("Cadastre-se para ver os preços da tabela.");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("heading", { name: "Acesso completo ao agente" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "Liberar acesso completo" })).toBeVisible();
  });

  it("celular: a barra abre o diálogo, Esc fecha e devolve o foco à barra", () => {
    mockViewport(true);
    render(<AgentShell mode="visitante" initialQuestion={null} />);
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
    render(<AgentShell mode="visitante" initialQuestion={null} />);
    fireEvent.click(screen.getByRole("button", { name: "cadeado" }));
    expect(screen.getByRole("dialog", { name: "Acesso completo ao agente" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Cadastre-se para ver os preços da tabela.");
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("celular: com o painel aberto, cabeçalho, chat e rodapé ficam inert", () => {
    mockViewport(true);
    const { container } = render(<AgentShell mode="visitante" initialQuestion={null} />);
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
    render(<AgentShell mode="visitante" initialQuestion={null} />);
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
    render(<AgentShell mode="cliente" initialQuestion={null} />);
    expect(screen.queryByRole("heading", { name: "Acesso completo ao agente" })).toBeNull();
    expect(screen.getByRole("link", { name: "Tabela de preços" })).toHaveAttribute("href", "/pedido-rapido");
    expect(screen.getByRole("link", { name: "Meus pedidos" })).toHaveAttribute("href", "/pedidos");
  });

  it("rodapé informa que as conversas são guardadas", () => {
    render(<AgentShell mode="visitante" initialQuestion={null} />);
    expect(screen.getByText(/conversas com o agente são guardadas/)).toBeInTheDocument();
  });
});
