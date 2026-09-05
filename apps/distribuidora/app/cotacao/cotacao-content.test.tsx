import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Palette } from "@mypet/core/theme";

const mocks = vi.hoisted(() => ({
  removeItem: vi.fn(),
  updateQty: vi.fn(),
}));

vi.mock("@mypet/core/components/cart-provider", () => ({
  useCart: () => ({
    cart: {
      items: [
        { id: "p1", name: "Coleira", qty: 2, img: "/coleira.jpg", brand: "MadPet", sku: "COL-1" },
      ],
    },
    removeItem: mocks.removeItem,
    updateQty: mocks.updateQty,
  }),
}));

import { CotacaoContent } from "./cotacao-content";

const palette = {
  white: "#fff",
  gray50: "#fafafa",
  gray100: "#f5f5f5",
  gray200: "#e5e5e5",
  gray400: "#a3a3a3",
  gray600: "#525252",
  gray800: "#262626",
  navy: "#111827",
  orange: "#b45309",
  pink: "#7144a4",
} as Palette;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CotacaoContent", () => {
  it("abre diretamente o WhatsApp com a cotação em texto, sem autenticação", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);

    render(<CotacaoContent palette={palette} />);
    fireEvent.change(screen.getByPlaceholderText("Seu nome"), { target: { value: "Fabio" } });
    fireEvent.change(screen.getByPlaceholderText("Nome do pet shop / empresa"), { target: { value: "My Pet" } });
    fireEvent.change(screen.getByPlaceholderText("WhatsApp com DDD"), { target: { value: "11999999999" } });
    fireEvent.change(screen.getByPlaceholderText("CNPJ (opcional)"), { target: { value: "12.345.678/0001-90" } });
    fireEvent.click(screen.getByRole("button", { name: /Enviar cotação pelo WhatsApp/i }));

    expect(open).toHaveBeenCalledOnce();
    const [url, target] = open.mock.calls[0];
    expect(target).toBe("_self");
    expect(url).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);

    const message = decodeURIComponent(String(url).split("?text=")[1]);
    expect(message).toContain("Coleira (SKU COL-1) — Qtd: 2");
    expect(message).toContain("Nome: Fabio");
    expect(message).toContain("Empresa: My Pet");
    expect(message).toContain("WhatsApp: 11999999999");
    expect(message).toContain("CNPJ: 12.345.678/0001-90");
  });
});
