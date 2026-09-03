import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { PaIcon } from "./icon";

describe("PaIcon", () => {
  it("renderiza um svg para um nome válido", () => {
    const { container } = render(<PaIcon name="Truck" />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("devolve null para um nome desconhecido", () => {
    const { container } = render(<PaIcon name="NaoExiste123" />);
    expect(container.querySelector("svg")).toBeNull();
  });
});
