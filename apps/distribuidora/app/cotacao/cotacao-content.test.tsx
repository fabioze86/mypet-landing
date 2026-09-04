import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Palette } from "@mypet/core/theme";

const mocks = vi.hoisted(() => ({
  clear: vi.fn(),
  finalizeQuote: vi.fn(),
  push: vi.fn(),
  removeItem: vi.fn(),
  updateQty: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock("@mypet/core/components/cart-provider", () => ({
  useCart: () => ({
    cart: {
      items: [
        { id: "p1", name: "Coleira", qty: 2, img: "/coleira.jpg", brand: "MadPet", sku: "COL-1" },
      ],
    },
    clear: mocks.clear,
    removeItem: mocks.removeItem,
    updateQty: mocks.updateQty,
  }),
}));
vi.mock("./actions", () => ({
  finalizeQuote: (...args: unknown[]) => mocks.finalizeQuote(...args),
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
  it("não abre about:blank e libera o botão quando a Server Action falha", async () => {
    mocks.finalizeQuote.mockRejectedValue(new Error("falha de rede"));
    const open = vi.spyOn(window, "open").mockReturnValue(null);

    render(<CotacaoContent palette={palette} />);
    fireEvent.click(screen.getByRole("button", { name: /Finalizar/i }));

    await waitFor(() => {
      expect(screen.getByText("Não foi possível enviar agora. Tente novamente.")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /Finalizar/i })).toBeEnabled();
    expect(open).not.toHaveBeenCalled();
  });
});
