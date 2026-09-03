import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { Testimonials } from "./testimonials";

describe("Testimonials", () => {
  it("renderiza 3 depoimentos com atribuição", () => {
    render(<Testimonials />);
    const region = screen.getByRole("region", { name: "O que dizem os lojistas" });
    expect(within(region).getAllByRole("figure")).toHaveLength(3);
    expect(within(region).getByText(/Renata Alcântara/)).toBeInTheDocument();
    expect(within(region).getByText(/Sorocaba, SP/)).toBeInTheDocument();
  });

  it("não usa em-dash na atribuição", () => {
    const { container } = render(<Testimonials />);
    expect(container.textContent ?? "").not.toMatch(/[–—]/);
  });
});
