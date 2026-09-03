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

  it("mantém o alvo de âncora do formulário de acesso", () => {
    const { container } = render(<Hero />);
    expect(container.querySelector("#acesso")).not.toBeNull();
    expect(container.querySelector("form")).not.toBeNull();
  });

  it("não usa em-dash na copy", () => {
    const { container } = render(<Hero />);
    expect(container.textContent ?? "").not.toMatch(/[–—]/);
  });
});
