import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/app/actions", () => ({ submitContact: vi.fn() }));

import { ContactForm } from "./contact-form";

describe("ContactForm", () => {
  it("marca o desafio como obrigatório, visual e semanticamente", () => {
    render(<ContactForm form="diagnostico" submitLabel="Solicitar diagnóstico" />);
    const desafio = screen.getByLabelText(/Seu desafio/);
    expect(desafio).toBeRequired();
    expect(screen.getByText("Seu desafio *")).toBeInTheDocument();
  });

  it("envia o tipo de formulário e esconde o honeypot", () => {
    const { container } = render(<ContactForm form="contato" submitLabel="Enviar" />);
    expect(container.querySelector('input[name="form"]')).toHaveValue("contato");
    expect(container.querySelector('input[name="website"]')).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("button", { name: "Enviar" })).toBeInTheDocument();
  });
});
