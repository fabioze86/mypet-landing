import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClientConfigProvider } from "@mypet/core/theme";
import { CartProvider } from "@mypet/core/components/cart-provider";
import { formatPrice } from "@mypet/core/catalog-utils";
import { clientConfig } from "@/client.config";

const mocks = vi.hoisted(() => ({ registerOrder: vi.fn() }));
vi.mock("./register-order", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./register-order")>()),
  registerOrder: mocks.registerOrder,
}));

import { __resetIdentityForTests, saveIdentity } from "../identity/identity-store";
import { IdentityGateProvider } from "../identity/identity-gate";
import { CotacaoContent } from "./cotacao-content";

const P1 = "11111111-1111-4111-8111-111111111111";
const P2 = "22222222-2222-4222-8222-222222222222";

function renderPage() {
  return render(
    <ClientConfigProvider config={clientConfig}>
      <CartProvider>
        <IdentityGateProvider>
          <CotacaoContent palette={clientConfig.palette} />
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
  localStorage.setItem(
    "mypet_cart",
    JSON.stringify({
      items: [
        { id: P1, name: "Coleira", sku: "COL-1", brand: "MadPet", img: "/c.jpg", qty: 2, unitPrice: 10 },
        { id: P2, name: "Guia", sku: "", brand: null, img: "/g.jpg", qty: 1 },
      ],
    }),
  );
  saveIdentity({ nome: "Ana", whatsapp: "5511999998888", cnpj: "11222333000181" });
});

describe("CotacaoContent (revisão)", () => {
  it("mostra itens, total e os dados identificados, sem formulário", () => {
    renderPage();
    expect(screen.getAllByText(formatPrice(20)!.replace(/\s/g, " ")).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("a consultar")).toBeInTheDocument();
    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(screen.getByText("(11) 99999-8888")).toBeInTheDocument();
    expect(screen.getByText("11.222.333/0001-81")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("Alterar dados reabre o pop-up", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Alterar dados" }));
    expect(screen.getByRole("dialog", { name: "Acesse o catálogo" })).toBeInTheDocument();
  });

  it("Fechar pedido pelo WhatsApp grava e abre o WhatsApp", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    mocks.registerOrder.mockResolvedValue({ kind: "ok", number: 1042, prices: new Map([[P1, 12], [P2, null]]), unavailableIds: [] });
    renderPage();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: /Fechar pedido pelo WhatsApp/ })));
    const message = decodeURIComponent(String(open.mock.calls[0][0]).split("?text=")[1]);
    expect(message.split("\n")[0]).toBe("Pedido #1042");
    expect(message).toContain(`Coleira (SKU COL-1) — 2 × ${formatPrice(12)} = ${formatPrice(24)}`);
    expect(message).toContain("Guia — Qtd: 1 (a consultar)");
  });

  it("erro de validação aparece acima do botão", async () => {
    vi.spyOn(window, "open").mockReturnValue(null);
    mocks.registerOrder.mockResolvedValue({ kind: "invalid", error: "Há um item inválido no carrinho." });
    renderPage();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: /Fechar pedido pelo WhatsApp/ })));
    expect(screen.getByRole("alert")).toHaveTextContent("Há um item inválido no carrinho.");
  });
});
