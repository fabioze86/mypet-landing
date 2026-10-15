import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { AgentMessage } from "@mypet/core/agent-client";

const chat = vi.hoisted(() => ({
  state: {
    messages: [] as AgentMessage[],
    busy: false,
    error: null as { code: string | null; message: string } | null,
  },
  sendText: vi.fn(() => true),
  clearNotice: vi.fn(),
}));

vi.mock("@mypet/core/agent-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mypet/core/agent-client")>();
  return {
    ...actual,
    useAgentConversation: () => ({
      conversation: { id: "3f1c2a7e-8b4d-4c1a-9f2e-1a2b3c4d5e6f", messages: [] },
      reset: vi.fn(),
      notice: "Começamos uma nova conversa. Envie sua pergunta de novo.",
      clearNotice: chat.clearNotice,
    }),
    useAgentChat: () => ({ ...chat.state, sendText: chat.sendText }),
  };
});
vi.mock("@mypet/core/components/cart-provider", () => ({ useCart: () => ({ cart: { items: [] } }) }));

import { AgentChat } from "./agent-chat";

const product = {
  id: "p1",
  name: "Shampoo Neutro",
  sku: "S1",
  brand: "Pet Clean",
  variantLabel: "5L",
  img: "/x.jpg",
  unitPrice: 89.9,
  priceLabel: "R$ 89,90",
};

function assistantWithProducts(priced: boolean): AgentMessage {
  return {
    id: "a1",
    role: "assistant",
    parts: [
      {
        type: "tool-buscar_produtos",
        toolCallId: "c1",
        state: "output-available",
        input: { query: "shampoo" },
        output: { total: 1, produtos: [priced ? product : { ...product, unitPrice: null, priceLabel: null }] },
      },
      { type: "text", text: "Encontrei estas opções. Veja também /central-de-ajuda/a/frete." },
    ],
  } as unknown as AgentMessage;
}

function renderChat(mode: "visitante" | "cliente", extra: Partial<Parameters<typeof AgentChat>[0]> = {}) {
  const props = {
    mode,
    initialQuestion: null,
    onInitialQuestionUsed: vi.fn(),
    onLockedIntent: vi.fn(),
    ...extra,
  };
  render(<AgentChat {...props} />);
  return props;
}

beforeEach(() => {
  chat.state = { messages: [], busy: false, error: null };
  chat.sendText = vi.fn(() => true);
  chat.clearNotice.mockClear();
});

afterEach(() => vi.restoreAllMocks());

describe("AgentChat", () => {
  it("visitante: boas-vindas com intenções livres e com cadeado", () => {
    const props = renderChat("visitante");
    expect(screen.getByRole("heading", { name: "Como posso te ajudar hoje?" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Frete e prazos de entrega/ }));
    expect(chat.sendText).toHaveBeenCalledWith("Como funciona o frete e qual o prazo de entrega?");

    fireEvent.click(screen.getByRole("button", { name: /Ver preços/ }));
    expect(props.onLockedIntent).toHaveBeenCalledWith("Cadastre-se para ver os preços da tabela.");
    expect(chat.sendText).toHaveBeenCalledTimes(1);
  });

  it("cliente: sem intenções com cadeado", () => {
    renderChat("cliente");
    expect(screen.queryByRole("button", { name: /Ver preços/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Encontrar produtos e preços/ })).toBeInTheDocument();
  });

  it("envia a pergunta digitada e limpa o campo", () => {
    renderChat("visitante");
    const input = screen.getByLabelText("Sua pergunta");
    fireEvent.change(input, { target: { value: "Tem shampoo?" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(chat.sendText).toHaveBeenCalledWith("Tem shampoo?");
    expect(input).toHaveValue("");
  });

  it("visitante: produtos sem preço, com convite ao cadastro", () => {
    chat.state.messages = [
      { id: "m1", role: "user", parts: [{ type: "text", text: "Tem shampoo?" }] } as AgentMessage,
      assistantWithProducts(false),
    ];
    const props = renderChat("visitante");
    expect(screen.getByText("Tem shampoo?")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Produtos encontrados" })).toHaveTextContent("Shampoo Neutro — 5L");
    expect(screen.queryByText(/R\$/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Cadastre-se para ver o preço" }));
    expect(props.onLockedIntent).toHaveBeenCalledWith("Cadastre-se para ver os preços da tabela.");
    expect(screen.getByRole("link", { name: "/central-de-ajuda/a/frete" })).toHaveAttribute(
      "href",
      "/central-de-ajuda/a/frete",
    );
  });

  it("cliente: produtos com preço e link para a tabela", () => {
    chat.state.messages = [assistantWithProducts(true)];
    renderChat("cliente");
    expect(screen.getByText("R$ 89,90")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver na tabela" })).toHaveAttribute("href", "/pedido-rapido");
  });

  it("cliente: produto sem preço (mensagem antiga de visitante) só convida a ver o preço na tabela", () => {
    chat.state.messages = [assistantWithProducts(false)];
    renderChat("cliente");
    expect(screen.queryByText(/Sob consulta/)).toBeNull();
    expect(screen.queryByRole("link", { name: "Ver na tabela" })).toBeNull();
    expect(screen.getByRole("link", { name: "Ver preço na tabela" })).toHaveAttribute("href", "/pedido-rapido");
  });

  it("aviso de conversa nova some quando uma pergunta é aceita, não quando é recusada", () => {
    renderChat("visitante");
    expect(screen.getByRole("status")).toBeInTheDocument();
    chat.sendText.mockReturnValueOnce(false);
    fireEvent.click(screen.getByRole("button", { name: /Frete e prazos de entrega/ }));
    expect(chat.clearNotice).not.toHaveBeenCalled();
    const input = screen.getByLabelText("Sua pergunta");
    fireEvent.change(input, { target: { value: "Tem shampoo?" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(chat.clearNotice).toHaveBeenCalledTimes(1);
  });

  it("pergunta inicial tira só ?pergunta= da URL, mantendo os outros parâmetros", () => {
    window.history.replaceState(null, "", "/agente?pergunta=x&utm_source=y");
    const spy = vi.spyOn(window.history, "replaceState");
    renderChat("visitante", { initialQuestion: "x" });
    expect(spy).toHaveBeenCalledWith(null, "", "/agente?utm_source=y");
  });

  it("mostra o erro", () => {
    chat.state.error = { code: "RATE_LIMITED", message: "Aguarde alguns minutos." };
    renderChat("visitante");
    expect(screen.getByRole("alert")).toHaveTextContent("Aguarde alguns minutos.");
  });

  it("envia a pergunta inicial uma vez e avisa que foi usada", () => {
    const props = renderChat("visitante", { initialQuestion: "Qual o pedido mínimo?" });
    expect(chat.sendText).toHaveBeenCalledWith("Qual o pedido mínimo?");
    expect(props.onInitialQuestionUsed).toHaveBeenCalledTimes(1);
  });

  it("pergunta inicial recusada fica pendente e é reenviada quando o envio volta", () => {
    const refused = vi.fn(() => false);
    chat.sendText = refused;
    const props = {
      mode: "visitante" as const,
      initialQuestion: "Qual o pedido mínimo?",
      onInitialQuestionUsed: vi.fn(),
      onLockedIntent: vi.fn(),
    };
    const { rerender } = render(<AgentChat {...props} />);
    expect(refused).toHaveBeenCalledWith("Qual o pedido mínimo?");
    expect(props.onInitialQuestionUsed).not.toHaveBeenCalled();

    const accepted = vi.fn(() => true);
    chat.sendText = accepted;
    rerender(<AgentChat {...props} />);
    expect(accepted).toHaveBeenCalledWith("Qual o pedido mínimo?");
    expect(props.onInitialQuestionUsed).toHaveBeenCalledTimes(1);
  });

  it("só linkifica caminhos isolados", () => {
    chat.state.messages = [
      {
        id: "a2",
        role: "assistant",
        parts: [{ type: "text", text: "Use e/ou /cadastros, veja https://x.com/pedidos e depois /pedidos." }],
      } as AgentMessage,
    ];
    renderChat("visitante");
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveTextContent("/pedidos");
    expect(links[0].nextSibling?.textContent).toBe(".");
  });

  it("visitante nunca vê preço, mesmo se o payload trouxer priceLabel", () => {
    chat.state.messages = [assistantWithProducts(true)];
    renderChat("visitante");
    expect(screen.queryByText(/R\$/)).toBeNull();
    expect(screen.getByRole("button", { name: "Cadastre-se para ver o preço" })).toBeInTheDocument();
  });
});
