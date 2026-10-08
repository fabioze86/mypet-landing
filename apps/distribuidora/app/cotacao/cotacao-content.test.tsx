import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Palette } from "@mypet/core/theme";
import { formatPrice } from "@mypet/core/catalog-utils";

const mocks = vi.hoisted(() => ({
  removeItem: vi.fn(),
  updateQty: vi.fn(),
  clear: vi.fn(),
  registerOrder: vi.fn(),
}));

vi.mock("@mypet/core/components/cart-provider", () => ({
  useCart: () => ({
    cart: {
      items: [
        { id: "p1", name: "Coleira", qty: 2, img: "/coleira.jpg", brand: "MadPet", sku: "COL-1", unitPrice: 10 },
        { id: "p2", name: "Guia", qty: 1, img: "/guia.jpg", brand: null, sku: "" },
      ],
    },
    removeItem: mocks.removeItem,
    updateQty: mocks.updateQty,
    clear: mocks.clear,
  }),
}));

vi.mock("./register-order", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./register-order")>()),
  registerOrder: mocks.registerOrder,
}));

import { CotacaoContent } from "./cotacao-content";

const palette = {
  white: "#fff", gray50: "#fafafa", gray100: "#f5f5f5", gray200: "#e5e5e5", gray400: "#a3a3a3",
  gray600: "#525252", gray800: "#262626", navy: "#111827", orange: "#b45309", pink: "#7144a4",
} as Palette;

function fillAndSubmit() {
  fireEvent.change(screen.getByPlaceholderText("Seu nome"), { target: { value: "Fabio" } });
  fireEvent.change(screen.getByPlaceholderText("Nome do pet shop / empresa"), { target: { value: "My Pet" } });
  fireEvent.change(screen.getByPlaceholderText("WhatsApp com DDD"), { target: { value: "11999999999" } });
  fireEvent.click(screen.getByRole("button", { name: /Enviar pedido pelo WhatsApp/i }));
}

function sentMessage(open: ReturnType<typeof vi.spyOn>) {
  const [url, target] = open.mock.calls[0];
  expect(target).toBe("_self");
  expect(url).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);
  return decodeURIComponent(String(url).split("?text=")[1]);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CotacaoContent", () => {
  it("mostra subtotal por linha, a consultar e o total", () => {
    render(<CotacaoContent palette={palette} />);
    // R$ 20,00 aparece no subtotal da Coleira e no total.
    expect(screen.getAllByText(formatPrice(20)!.replace(/\s/g, " ")).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("a consultar")).toBeInTheDocument();
    expect(screen.getByText("Total de unidades")).toBeInTheDocument();
    expect(screen.getByTestId("cart-total")).toHaveTextContent(formatPrice(20)!.replace(/\s/g, " "));
    expect(screen.getByText(/Itens sem preço serão confirmados pelo atendente/)).toBeInTheDocument();
  });

  it("grava o pedido e abre o WhatsApp com número e preço do servidor", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    mocks.registerOrder.mockResolvedValue({ kind: "ok", number: 1042, prices: new Map([["p1", 12], ["p2", null]]), unavailableIds: [] });

    render(<CotacaoContent palette={palette} />);
    await act(async () => fillAndSubmit());

    expect(mocks.registerOrder).toHaveBeenCalledOnce();
    const message = sentMessage(open);
    expect(message.split("\n")[0]).toBe("Pedido #1042");
    expect(message).toContain(`Coleira (SKU COL-1) — 2 × ${formatPrice(12)} = ${formatPrice(24)}`);
    expect(message).toContain("Guia — Qtd: 1 (a consultar)");
    expect(message).toContain("Nome: Fabio");
    expect(mocks.clear).toHaveBeenCalledOnce();
  });

  it("item indisponível segue na mensagem como a consultar", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    mocks.registerOrder.mockResolvedValue({ kind: "ok", number: 1043, prices: new Map([["p2", 5]]), unavailableIds: ["p1"] });

    render(<CotacaoContent palette={palette} />);
    await act(async () => fillAndSubmit());

    const message = sentMessage(open);
    expect(message.split("\n")[0]).toBe("Pedido #1043");
    expect(message).toContain("Coleira (SKU COL-1) — Qtd: 2 (a consultar)");
    expect(message).toContain(`Guia — 1 × ${formatPrice(5)} = ${formatPrice(5)}`);
  });

  it("se a gravação falhar, abre o WhatsApp mesmo assim sem número", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    mocks.registerOrder.mockResolvedValue({ kind: "failed" });

    render(<CotacaoContent palette={palette} />);
    await act(async () => fillAndSubmit());

    const message = sentMessage(open);
    expect(message).not.toContain("Pedido #");
    expect(message).toContain(`Coleira (SKU COL-1) — 2 × ${formatPrice(10)} = ${formatPrice(20)}`);
  });

  it("erro de validação aparece no formulário e não abre o WhatsApp", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    mocks.registerOrder.mockResolvedValue({ kind: "invalid", error: "Um dos produtos não está mais disponível." });

    render(<CotacaoContent palette={palette} />);
    await act(async () => fillAndSubmit());

    expect(open).not.toHaveBeenCalled();
    expect(screen.getByText("Um dos produtos não está mais disponível.")).toBeInTheDocument();
    expect(mocks.clear).not.toHaveBeenCalled();
  });
});
