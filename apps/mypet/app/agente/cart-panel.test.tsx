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
    expect(screen.getAllByText("R$ 899,00").length).toBeGreaterThan(0);
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
});
