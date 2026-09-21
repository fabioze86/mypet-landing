import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Hero } from "./hero";

describe("Hero", () => {
  it("tem um h1 com uma palavra destacada", () => {
    render(<Hero />);
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1).toHaveTextContent(/atacado/i);
    expect(h1.querySelector(".pa-hl")).not.toBeNull();
  });

  it("tem um CTA para a página de cadastro", () => {
    render(<Hero />);
    const link = screen.getByRole("link", { name: "Consultar preços" });
    expect(link).toHaveAttribute("href", "/cadastro");
  });

  it("não usa em-dash na copy", () => {
    const { container } = render(<Hero />);
    expect(container.textContent ?? "").not.toMatch(/[–—]/);
  });
});
