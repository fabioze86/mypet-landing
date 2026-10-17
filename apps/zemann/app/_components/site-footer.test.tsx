import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SiteFooter } from "./site-footer";

describe("SiteFooter", () => {
  it("mostra razão social, CNPJ, e-mail e o aviso de marca da Amazon", () => {
    render(<SiteFooter />);
    expect(screen.getByText(/DPZ COMMERCE/)).toBeInTheDocument();
    expect(screen.getByText(/67\.145\.989\/0001-00/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "contato@zemann.com.br" })).toHaveAttribute(
      "href",
      "mailto:contato@zemann.com.br",
    );
    expect(screen.getByText(/A Zemann não é afiliada à Amazon/)).toBeInTheDocument();
  });
});
