import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const cartState = vi.hoisted(() => ({
  items: [] as { id: string; name: string; sku: string; brand: string | null; img: string; qty: number; unitPrice?: number }[],
  updateQty: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}));
const finalizeQuote = vi.hoisted(() => vi.fn());
const buildOrderWhatsAppUrl = vi.hoisted(() => vi.fn(() => "https://wa.me/55?text=x"));
const hasWhatsAppNumber = vi.hoisted(() => vi.fn(() => true));

vi.mock("@mypet/core/components/cart-provider", () => ({
  useCart: () => ({
    cart: { items: cartState.items },
    updateQty: cartState.updateQty,
    removeItem: cartState.removeItem,
    clear: cartState.clear,
  }),
}));
vi.mock("../cotacao/actions", () => ({ finalizeQuote: (...a: unknown[]) => finalizeQuote(...a) }));
vi.mock("../cotacao/whatsapp-order", () => ({
  buildOrderWhatsAppUrl: (...a: unknown[]) => buildOrderWhatsAppUrl(...(a as [])),
  hasWhatsAppNumber: () => hasWhatsAppNumber(),
}));

import { CartPanel } from "./cart-panel";

const item = { id: "p1", name: "Shampoo Neutro — 5L", sku: "S1", brand: "Pet Clean", img: "/x.jpg", qty: 10, unitPrice: 89.9 };
const open = vi.fn();

beforeEach(() => {
  cartState.items = [];
  vi.clearAllMocks();
  hasWhatsAppNumber.mockReturnValue(true);
  vi.stubGlobal("open", open);
});

describe("CartPanel", () => {
  it("vazio: orienta a pedir ao agente", () => {
    render(<CartPanel conversationId={null} />);
    expect(screen.getByRole("heading", { name: "Seu pedido" })).toBeInTheDocument();
    expect(screen.getByText(/Seu pedido está vazio/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enviar pedido pelo WhatsApp" })).toBeNull();
  });

  it("lista itens com subtotal e total e permite mudar a quantidade", () => {
    cartState.items = [item];
    render(<CartPanel conversationId={null} />);
    expect(screen.getByText("Shampoo Neutro — 5L")).toBeInTheDocument();
    expect(screen.getByText("R$ 899,00", { selector: ".ag-cart-item-price" })).toBeInTheDocument();
    expect(screen.getByText("R$ 899,00", { selector: ".ag-cart-total strong" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Aumentar quantidade de Shampoo Neutro — 5L" }));
    expect(cartState.updateQty).toHaveBeenCalledWith("p1", 11, undefined);
    fireEvent.click(screen.getByRole("button", { name: "Tirar Shampoo Neutro — 5L do pedido" }));
    expect(cartState.removeItem).toHaveBeenCalledWith("p1", undefined);
  });

  it("envia pelo WhatsApp com a conversa de origem e limpa o pedido", async () => {
    cartState.items = [item];
    finalizeQuote.mockResolvedValue({ ok: true, buyer: { nome: "Ana", empresa: "X", whatsapp: "55", cnpj: null } });
    render(<CartPanel conversationId="3f1c2a7e-8b4d-4c1a-9f2e-1a2b3c4d5e6f" />);
    fireEvent.click(screen.getByRole("button", { name: "Enviar pedido pelo WhatsApp" }));
    await waitFor(() => expect(cartState.clear).toHaveBeenCalled());
    expect(finalizeQuote).toHaveBeenCalledWith([item], { agentConversationId: "3f1c2a7e-8b4d-4c1a-9f2e-1a2b3c4d5e6f" });
    expect(open).toHaveBeenCalledWith("https://wa.me/55?text=x", "_blank");
    expect(screen.getByRole("status")).toHaveTextContent("Pedido enviado!");
  });

  it("depois do envio mostra o link visível Abrir WhatsApp com a URL do pedido e leva o foco à confirmação", async () => {
    cartState.items = [item];
    buildOrderWhatsAppUrl.mockReturnValueOnce("https://wa.me/5511999998888?text=pedido");
    finalizeQuote.mockResolvedValue({ ok: true, buyer: { nome: "Ana", empresa: "X", whatsapp: "55", cnpj: null } });
    render(<CartPanel conversationId={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Enviar pedido pelo WhatsApp" }));
    const link = await screen.findByRole("link", { name: "Abrir WhatsApp" });
    expect(link).toHaveAttribute("href", "https://wa.me/5511999998888?text=pedido");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    // a tentativa automática continua
    expect(open).toHaveBeenCalledWith("https://wa.me/5511999998888?text=pedido", "_blank");
    // o botão some com o envio: o foco vai para a confirmação, não para o <body>
    await waitFor(() => expect(screen.getByRole("status")).toHaveFocus());
  });

  it("mostra o erro do envio e mantém o pedido", async () => {
    cartState.items = [item];
    finalizeQuote.mockResolvedValue({ ok: false, error: "Não foi possível registrar seu pedido." });
    render(<CartPanel conversationId={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Enviar pedido pelo WhatsApp" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível registrar seu pedido.");
    expect(cartState.clear).not.toHaveBeenCalled();
  });

  it("sem número do WhatsApp configurado não chama o servidor", () => {
    cartState.items = [item];
    hasWhatsAppNumber.mockReturnValue(false);
    render(<CartPanel conversationId={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Enviar pedido pelo WhatsApp" }));
    expect(finalizeQuote).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível abrir o WhatsApp agora.");
  });

  it("falha inesperada do servidor vira erro visível e mantém o pedido", async () => {
    cartState.items = [item];
    finalizeQuote.mockRejectedValue(new Error("rede"));
    render(<CartPanel conversationId={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Enviar pedido pelo WhatsApp" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível enviar seu pedido agora. Tente novamente em instantes.",
    );
    expect(cartState.clear).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Enviar pedido pelo WhatsApp" })).toBeEnabled();
  });

  it("precisa de acesso: leva para /agente", async () => {
    cartState.items = [item];
    finalizeQuote.mockResolvedValue({ ok: false, error: "x", needsAuth: true });
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    render(<CartPanel conversationId={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Enviar pedido pelo WhatsApp" }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/agente"));
  });

  it("depois de enviado, novos itens trazem a lista e o botão de volta", async () => {
    cartState.items = [item];
    finalizeQuote.mockResolvedValue({ ok: true, buyer: { nome: "Ana", empresa: "X", whatsapp: "55", cnpj: null } });
    const { rerender } = render(<CartPanel conversationId={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Enviar pedido pelo WhatsApp" }));
    await screen.findByRole("status");
    cartState.items = [];
    rerender(<CartPanel conversationId={null} />);
    expect(screen.getByRole("status")).toHaveTextContent("Pedido enviado!");
    cartState.items = [{ ...item, id: "p2", name: "Condicionador" }];
    rerender(<CartPanel conversationId={null} />);
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("button", { name: "Enviar pedido pelo WhatsApp" })).toBeInTheDocument();
  });

  it("o erro some quando os itens mudam", async () => {
    cartState.items = [item];
    finalizeQuote.mockResolvedValue({ ok: false, error: "Falhou." });
    const { rerender } = render(<CartPanel conversationId={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Enviar pedido pelo WhatsApp" }));
    await screen.findByRole("alert");
    cartState.items = [{ ...item, qty: 11 }];
    rerender(<CartPanel conversationId={null} />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("linha sem preço mostra aviso e o total indica itens sem preço", () => {
    cartState.items = [item, { ...item, id: "p2", name: "Escova", unitPrice: undefined }];
    render(<CartPanel conversationId={null} />);
    expect(screen.getByText("Preço na tabela")).toBeInTheDocument();
    expect(screen.getByText("+ itens sem preço")).toBeInTheDocument();
  });
});
