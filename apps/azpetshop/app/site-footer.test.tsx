import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { formatCnpj, formatWhatsapp } from "@mypet/core/br-validation";
import { EMPRESA } from "@/lib/empresa";
import { POLITICAS } from "@/lib/politicas";
import { SiteFooter } from "./site-footer";

describe("SiteFooter", () => {
  it("mostra razão social, CNPJ formatado, e-mail e endereço", () => {
    render(<SiteFooter />);
    expect(screen.getByText(new RegExp(EMPRESA.razaoSocial))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(formatCnpj(EMPRESA.cnpj).replace(/[./-]/g, "\\$&")))).toBeInTheDocument();
    expect(screen.getByRole("link", { name: EMPRESA.email })).toHaveAttribute("href", `mailto:${EMPRESA.email}`);
    expect(screen.getByText(new RegExp(EMPRESA.endereco.cidade))).toBeInTheDocument();
  });

  it("o WhatsApp é um link para wa.me", () => {
    render(<SiteFooter />);
    const link = screen.getByRole("link", { name: `WhatsApp ${formatWhatsapp(EMPRESA.whatsapp)}` });
    expect(link).toHaveAttribute("href", `https://wa.me/${EMPRESA.whatsapp}`);
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("linka as 4 políticas", () => {
    render(<SiteFooter />);
    for (const p of POLITICAS) {
      expect(screen.getByRole("link", { name: p.titulo })).toHaveAttribute("href", `/politicas/${p.slug}`);
    }
  });

  it("mostra as formas de pagamento", () => {
    render(<SiteFooter />);
    expect(screen.getByText(/Pix/)).toBeInTheDocument();
    expect(screen.getByText(/cartão de crédito/i)).toBeInTheDocument();
  });
});
