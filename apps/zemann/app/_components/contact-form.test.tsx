import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ContactState } from "@/lib/contact";

const submitContact = vi.hoisted(() => vi.fn());
vi.mock("@/app/actions", () => ({ submitContact }));

import { ContactForm } from "./contact-form";

function renderForm() {
  const utils = render(<ContactForm form="diagnostico" submitLabel="Solicitar diagnóstico" />);
  return utils;
}

async function submit(state: ContactState) {
  submitContact.mockResolvedValueOnce(state);
  fireEvent.click(screen.getByRole("button", { name: "Solicitar diagnóstico" }));
}

describe("ContactForm", () => {
  beforeEach(() => {
    submitContact.mockReset();
    window.gtag = vi.fn();
  });

  it("marca o desafio como obrigatório, visual e semanticamente", () => {
    renderForm();
    const desafio = screen.getByRole("textbox", { name: "Seu desafio" });
    expect(desafio).toBeRequired();
    expect(screen.getByText("Seu desafio")).toBeInTheDocument();
    expect(desafio.closest("div")?.textContent).toContain("*");
  });

  it("envia o tipo de formulário e esconde o honeypot", () => {
    const { container } = render(<ContactForm form="contato" submitLabel="Enviar" />);
    expect(container.querySelector('input[name="form"]')).toHaveValue("contato");
    expect(container.querySelector('input[name="website"]')).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("button", { name: "Enviar" })).toBeInTheDocument();
  });

  it("mostra o erro do campo, liga ao campo e leva o foco ao primeiro inválido", async () => {
    renderForm();
    await submit({
      status: "error",
      message: "Confira os campos destacados.",
      errors: { empresa: "Informe a empresa ou marca.", desafio: "Conte em poucas palavras o seu desafio." },
      values: { nome: "Ana", empresa: "" },
      attempt: 1,
    });
    const erro = await screen.findByText("Conte em poucas palavras o seu desafio.");
    const desafio = screen.getByRole("textbox", { name: "Seu desafio" });
    expect(desafio).toHaveAttribute("aria-invalid", "true");
    expect(desafio).toHaveAttribute("aria-describedby", erro.id);
    expect(erro.id).toBeTruthy();
    await waitFor(() => expect(screen.getByRole("textbox", { name: /Empresa ou marca/ })).toHaveFocus());
  });

  it("restaura os valores devolvidos nos campos", async () => {
    renderForm();
    await submit({
      status: "error",
      message: "Confira os campos destacados.",
      errors: { desafio: "Conte em poucas palavras o seu desafio." },
      values: { empresa: "Marca X" },
      attempt: 1,
    });
    await screen.findByText("Conte em poucas palavras o seu desafio.");
    expect(screen.getByRole("textbox", { name: /Empresa ou marca/ })).toHaveValue("Marca X");
  });

  it("no sucesso mostra o status e dispara generate_lead uma vez", async () => {
    renderForm();
    await submit({ status: "success", message: "Recebemos sua mensagem.", errors: {}, values: {}, attempt: 1 });
    expect(await screen.findByRole("status")).toHaveTextContent("Recebemos sua mensagem.");
    expect(window.gtag).toHaveBeenCalledTimes(1);
    expect(window.gtag).toHaveBeenCalledWith("event", "generate_lead", { form: "diagnostico" });
  });

  it("em falha de envio sem erros de campo, mostra o alerta e foca nele", async () => {
    renderForm();
    await submit({ status: "error", message: "Não foi possível enviar agora.", errors: {}, values: { nome: "Ana" }, attempt: 1 });
    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent("Não foi possível enviar agora.");
    await waitFor(() => expect(alerta).toHaveFocus());
  });
});
