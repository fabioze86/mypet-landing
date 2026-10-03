import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { ClosingCta } from "./closing-cta";

describe("ClosingCta", () => {
  it("tem um CTA para /cadastro com o rótulo padrão", () => {
    render(<ClosingCta />);
    const region = screen.getByRole("region", { name: /monte seu próximo pedido pela tabela/i });
    const link = within(region).getByRole("link", { name: "Liberar tabela de preços" });
    expect(link).toHaveAttribute("href", "/cadastro");
  });
});
