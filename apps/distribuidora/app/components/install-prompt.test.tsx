import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ cartBarVisible: false }));

vi.mock("@mypet/core/components/cart-bar", () => ({
  CART_BAR_HEIGHT: 60,
  useCartBarVisible: () => state.cartBarVisible,
}));
vi.mock("@mypet/core/theme", () => ({
  useClientConfig: () => ({ name: "Teste", palette: { navy: "#123" } }),
}));
vi.mock("@mypet/core/push", () => ({ subscribeToPush: vi.fn() }));

import InstallPrompt from "./install-prompt";

beforeEach(() => {
  state.cartBarVisible = false;
  localStorage.clear();
  // Celular (não instalado): o banner aparece.
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes("max-width"),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
});

async function renderPrompt() {
  render(<InstallPrompt />);
  await act(async () => {});
  return screen.getByRole("dialog", { name: "Instalar aplicativo" });
}

describe("InstallPrompt", () => {
  it("sem barra do carrinho fica colado no rodapé", async () => {
    const banner = await renderPrompt();
    expect(banner.style.bottom).toBe("0px");
  });

  it("com a barra do carrinho visível fica acima dela", async () => {
    state.cartBarVisible = true;
    const banner = await renderPrompt();
    expect(banner.style.bottom).toBe("calc(60px + env(safe-area-inset-bottom))");
  });
});
