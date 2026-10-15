// @vitest-environment jsdom
import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, beforeEach, vi } from "vitest";
import { CartProvider } from "@mypet/core/components/cart-provider";
import { ClientConfigProvider, type ClientConfig } from "@mypet/core/theme";
import { CotacaoContent } from "./cotacao-content";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("./actions", () => ({ finalizeQuote: vi.fn() }));
vi.mock("./whatsapp-order", () => ({
  hasWhatsAppNumber: () => true,
  buildOrderWhatsAppUrl: vi.fn(() => "https://wa.me/5511999998888?text=pedido"),
}));

import { finalizeQuote } from "./actions";
import { buildOrderWhatsAppUrl } from "./whatsapp-order";

const config: ClientConfig = {
  name: "My Pet Brasil",
  tagline: "Atacado B2B",
  domain: "mypetbrasil.com.br",
  catalogChannel: "mypetbrasil",
  logo: { emoji: "🐾" },
  features: { commerce: "quote" },
  palette: {
    pink: "#f0a", pinkDark: "#c07", pinkLight: "#fde", cyan: "#0cc", cyanDark: "#099", cyanLight: "#eff",
    navy: "#123", navyDark: "#012", navyLight: "#def", orange: "#f80", green: "#090", white: "#fff",
    gray50: "#fafafa", gray100: "#eee", gray200: "#ddd", gray400: "#999", gray600: "#666", gray800: "#333",
  },
};

function renderWithCart(cartItems: Record<string, unknown>[]) {
  localStorage.setItem("mypet_cart", JSON.stringify({ items: cartItems }));
  return render(
    createElement(
      ClientConfigProvider,
      { config },
      createElement(CartProvider, null, createElement(CotacaoContent, { palette: config.palette })),
    ),
  );
}

describe("CotacaoContent — subtotal e total", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("mostra subtotal por linha e o total geral quando todos os itens têm unitPrice", () => {
    renderWithCart([
      { id: "p1", name: "Ração X", sku: "100", brand: "NAPI", img: "/img.jpg", qty: 2, unitPrice: 42.9 },
      { id: "p2", name: "Areia Y", sku: "200", brand: "NAPI", img: "/img2.jpg", qty: 1, unitPrice: 30 },
    ]);

    expect(screen.getByText("R$ 85,80")).toBeInTheDocument();
    expect(screen.getByText("R$ 30,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 115,80")).toBeInTheDocument();
  });

  it("mostra — no subtotal de item sem unitPrice e não o inclui no total geral", () => {
    renderWithCart([
      { id: "p1", name: "Ração X", sku: "100", brand: "NAPI", img: "/img.jpg", qty: 2 },
      { id: "p2", name: "Areia Y", sku: "200", brand: "NAPI", img: "/img2.jpg", qty: 2, unitPrice: 30 },
    ]);

    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    expect(screen.getAllByText("R$ 60,00").length).toBeGreaterThanOrEqual(1);
  });

  it("mostra total mesmo com apenas um item precificado", () => {
    renderWithCart([
      { id: "p1", name: "Ração X", sku: "100", brand: "NAPI", img: "/img.jpg", qty: 3, unitPrice: 50 },
    ]);

    expect(screen.getByText(/Total:/)).toBeInTheDocument();
    expect(screen.getAllByText("R$ 150,00").length).toBeGreaterThanOrEqual(1);
  });
});

describe("CotacaoContent — envio", () => {
  const open = vi.fn();
  beforeEach(() => {
    localStorage.clear();
    open.mockReset();
    vi.stubGlobal("open", open);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("depois do envio mostra o link visível Abrir WhatsApp com a URL do pedido", async () => {
    vi.mocked(finalizeQuote).mockResolvedValue({
      ok: true,
      buyer: { nome: "Ana", empresa: "Loja", whatsapp: "11999998888", cnpj: null },
    });
    renderWithCart([{ id: "p1", name: "Ração X", sku: "100", brand: "NAPI", img: "/img.jpg", qty: 2, unitPrice: 42.9 }]);
    fireEvent.click(screen.getByRole("button", { name: "Enviar pedido pelo WhatsApp" }));

    const link = await screen.findByRole("link", { name: "Abrir WhatsApp" });
    expect(link).toHaveAttribute("href", "https://wa.me/5511999998888?text=pedido");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(buildOrderWhatsAppUrl).toHaveBeenCalled();
    // a tentativa automática continua
    expect(open).toHaveBeenCalledWith("https://wa.me/5511999998888?text=pedido", "_blank");
    expect(screen.getByText("Pedido enviado!")).toBeInTheDocument();
  });

  it("se finalizeQuote lançar erro, mostra mensagem e destrava o botão", async () => {
    vi.mocked(finalizeQuote).mockRejectedValue(new Error("falha de rede"));
    renderWithCart([{ id: "p1", name: "Ração X", sku: "100", brand: "NAPI", img: "/img.jpg", qty: 2, unitPrice: 42.9 }]);
    fireEvent.click(screen.getByRole("button", { name: "Enviar pedido pelo WhatsApp" }));

    expect(
      await screen.findByText("Não foi possível enviar seu pedido agora. Tente novamente em instantes."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar pedido pelo WhatsApp" })).toBeEnabled();
  });
});
