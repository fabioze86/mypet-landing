import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { HowItWorks } from "./how-it-works";

describe("HowItWorks", () => {
  it("renderiza 4 passos numerados", () => {
    render(<HowItWorks />);
    const region = screen.getByRole("region", { name: /como funciona/i });
    expect(within(region).getByText("1")).toBeInTheDocument();
    expect(within(region).getByText("4")).toBeInTheDocument();
    expect(within(region).getByText("Acesso liberado na hora")).toBeInTheDocument();
    expect(within(region).getAllByRole("listitem")).toHaveLength(4);
  });
});
