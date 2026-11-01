import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({ finalizeQuote: vi.fn() }));
vi.mock("@mypet/core/components/cart-provider", () => ({
  useCart: () => ({
    cart: { items: [{ id: "a", name: "Shampoo", sku: "S", brand: null, img: "/s.jpg", qty: 1, unitPrice: 25 }] },
    removeItem: vi.fn(), updateQty: vi.fn(), clear: vi.fn(),
  }),
}));

import { CotacaoContent } from "./cotacao-content";
import { clientConfig } from "@/client.config";

describe("CotacaoContent — modos de finalização", () => {
  it("ambos: mostra Pagar agora e o formulário do WhatsApp", () => {
    render(<CotacaoContent palette={clientConfig.palette} checkout={{ online: true, whatsapp: true }} />);
    expect(screen.getByRole("link", { name: "Pagar agora" })).toHaveAttribute("href", "/checkout");
    expect(screen.getByRole("button", { name: /WhatsApp/ })).toBeInTheDocument();
  });

  it("whatsapp: sem Pagar agora", () => {
    render(<CotacaoContent palette={clientConfig.palette} checkout={{ online: false, whatsapp: true }} />);
    expect(screen.queryByRole("link", { name: "Pagar agora" })).toBeNull();
  });

  it("online: sem formulário do WhatsApp", () => {
    render(<CotacaoContent palette={clientConfig.palette} checkout={{ online: true, whatsapp: false }} />);
    expect(screen.getByRole("link", { name: "Pagar agora" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /WhatsApp/ })).toBeNull();
  });
});
