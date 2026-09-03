import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { CommercialConditions } from "./commercial-conditions";

describe("CommercialConditions", () => {
  it("renderiza um card com ícone svg por condição", () => {
    const { container } = render(<CommercialConditions />);
    const region = screen.getByRole("region", { name: "Condições comerciais" });
    expect(within(region).getByText("Pedido mínimo")).toBeInTheDocument();
    expect(container.querySelectorAll(".pa-cond-card svg").length).toBe(3);
  });
});
