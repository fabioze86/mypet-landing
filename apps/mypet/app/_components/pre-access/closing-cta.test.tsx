import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { ClosingCta } from "./closing-cta";

describe("ClosingCta", () => {
  it("tem um CTA para #acesso com o rótulo padrão", () => {
    render(<ClosingCta />);
    const region = screen.getByRole("region", { name: /pronto para comprar no atacado/i });
    const link = within(region).getByRole("link", { name: "Criar acesso à loja" });
    expect(link).toHaveAttribute("href", "#acesso");
  });
});
