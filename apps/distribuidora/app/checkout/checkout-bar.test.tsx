import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClientConfigProvider } from "@mypet/core/theme";
import { CartProvider } from "@mypet/core/components/cart-provider";
import { clientConfig } from "@/client.config";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

const mocks = vi.hoisted(() => ({ registerOrder: vi.fn() }));
vi.mock("../cotacao/register-order", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../cotacao/register-order")>()),
  registerOrder: mocks.registerOrder,
}));

import { __resetIdentityForTests, saveIdentity } from "../identity/identity-store";
import { IdentityGateProvider } from "../identity/identity-gate";
import { CheckoutBar } from "./checkout-bar";

const P1 = "11111111-1111-4111-8111-111111111111";

function renderBar() {
  return render(
    <ClientConfigProvider config={clientConfig}>
      <CartProvider>
        <IdentityGateProvider>
          <CheckoutBar />
        </IdentityGateProvider>
      </CartProvider>
    </ClientConfigProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  __resetIdentityForTests();
  vi.restoreAllMocks();
  mocks.registerOrder.mockReset();
  localStorage.setItem("mypet_cart", JSON.stringify({ items: [{ id: P1, name: "Coleira", sku: "COL-1", brand: null, img: "/c.jpg", qty: 2, unitPrice: 10 }] }));
});

describe("CheckoutBar", () => {
  it("Fechar pedido grava e abre o WhatsApp com os dados da identidade", async () => {
    saveIdentity({ nome: "Ana", whatsapp: "5511999998888", cnpj: "11222333000181" });
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    mocks.registerOrder.mockResolvedValue({ kind: "ok", number: 1042, prices: new Map([[P1, 10]]), unavailableIds: [] });

    renderBar();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Fechar pedido →" })));

    expect(mocks.registerOrder).toHaveBeenCalledWith(expect.any(Array), { nome: "Ana", whatsapp: "5511999998888", cnpj: "11222333000181" });
    const message = decodeURIComponent(String(open.mock.calls[0][0]).split("?text=")[1]);
    expect(message.split("\n")[0]).toBe("Pedido #1042");
    expect(message).toContain("Nome: Ana");
    expect(message).toContain("WhatsApp: (11) 99999-8888");
    expect(message).toContain("CNPJ: 11.222.333/0001-81");
    expect(message).not.toContain("Empresa:");
    expect(open.mock.calls[0][1]).toBe("_self");
  });

  it("tem link ver itens para /cotacao", () => {
    saveIdentity({ nome: "Ana", whatsapp: "5511999998888", cnpj: null });
    renderBar();
    expect(screen.getByRole("link", { name: "ver itens" })).toHaveAttribute("href", "/cotacao");
  });

  it("erro de validação aparece e não abre o WhatsApp", async () => {
    saveIdentity({ nome: "Ana", whatsapp: "5511999998888", cnpj: null });
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    mocks.registerOrder.mockResolvedValue({ kind: "invalid", error: "Há um item inválido no carrinho." });
    renderBar();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Fechar pedido →" })));
    expect(open).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Há um item inválido no carrinho.");
  });

  it("duplo toque registra um pedido só", async () => {
    saveIdentity({ nome: "Ana", whatsapp: "5511999998888", cnpj: null });
    vi.spyOn(window, "open").mockReturnValue(null);
    let resolve!: (v: unknown) => void;
    mocks.registerOrder.mockReturnValue(new Promise((r) => { resolve = r; }));
    renderBar();
    const button = screen.getByRole("button", { name: "Fechar pedido →" });
    fireEvent.click(button);
    fireEvent.click(button);
    await act(async () => resolve({ kind: "failed" }));
    expect(mocks.registerOrder).toHaveBeenCalledOnce();
  });
});
