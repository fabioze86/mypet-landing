import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccessForm } from "./access-form";

const assign = vi.fn();

beforeEach(() => {
  assign.mockReset();
  vi.stubGlobal("fetch", vi.fn());
  Object.defineProperty(window, "location", { value: { assign }, writable: true });
});

describe("AccessForm", () => {
  it("envia exatamente cnpj, whatsapp e email para /api/pre-acesso", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    const user = userEvent.setup();
    render(<AccessForm />);

    await user.type(screen.getByLabelText("CNPJ"), "12.345.678/0001-95");
    await user.type(screen.getByLabelText("WhatsApp"), "(11) 99999-0000");
    await user.type(screen.getByLabelText(/E-mail/), "loja@example.com");
    await user.click(screen.getByRole("button", { name: "Criar acesso à loja" }));

    expect(fetch).toHaveBeenCalledWith(
      "/api/pre-acesso",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          cnpj: "12.345.678/0001-95",
          whatsapp: "(11) 99999-0000",
          email: "loja@example.com",
        }),
      }),
    );
    expect(assign).toHaveBeenCalledWith("/loja");
  });

  it("envia email vazio quando o campo fica em branco", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    const user = userEvent.setup();
    render(<AccessForm />);

    await user.type(screen.getByLabelText("CNPJ"), "12345678000195");
    await user.type(screen.getByLabelText("WhatsApp"), "5511999990000");
    await user.click(screen.getByRole("button", { name: "Criar acesso à loja" }));

    expect(fetch).toHaveBeenCalledWith(
      "/api/pre-acesso",
      expect.objectContaining({
        body: JSON.stringify({ cnpj: "12345678000195", whatsapp: "5511999990000", email: "" }),
      }),
    );
  });

  it("mostra o erro de WhatsApp no campo com DDD + número e não navega", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({
        error: {
          code: "INVALID_WHATSAPP",
          field: "whatsapp",
          message: "Informe o WhatsApp com DDD e número.",
        },
      }),
    });
    const user = userEvent.setup();
    render(<AccessForm />);

    await user.type(screen.getByLabelText("CNPJ"), "1");
    await user.type(screen.getByLabelText("WhatsApp"), "2");
    await user.click(screen.getByRole("button", { name: "Criar acesso à loja" }));

    const whatsapp = screen.getByLabelText("WhatsApp");
    expect(await screen.findByText("Informe o WhatsApp com DDD e número.")).toBeInTheDocument();
    expect(whatsapp).toHaveAttribute("aria-invalid", "true");
    expect(whatsapp).toHaveAttribute("aria-describedby", "pa-whatsapp-help pa-whatsapp-error");
    expect(assign).not.toHaveBeenCalled();
  });
});
