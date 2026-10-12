import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const askSupportAssistant = vi.fn();
vi.mock("@mypet/core/support-assistant-client", () => ({
  askSupportAssistant: (...args: unknown[]) => askSupportAssistant(...args),
}));

import { FaqAssistant } from "./faq-assistant";

beforeEach(() => {
  askSupportAssistant.mockReset();
});

describe("FaqAssistant", () => {
  it("envia a pergunta e mostra a resposta, com caminhos internos como link", async () => {
    askSupportAssistant.mockResolvedValue({
      ok: true,
      reply: "O mínimo é R$ 250 na capital. Veja /central-de-ajuda/a/pedido-minimo.",
    });
    render(<FaqAssistant channel="mypetbrasil" />);

    fireEvent.change(screen.getByLabelText("Sua dúvida"), { target: { value: "Qual o mínimo?" } });
    fireEvent.click(screen.getByRole("button", { name: "Perguntar" }));

    expect(await screen.findByText(/O mínimo é R\$ 250/)).toBeInTheDocument();
    expect(screen.getByText("Qual o mínimo?")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "/central-de-ajuda/a/pedido-minimo" })).toHaveAttribute(
      "href",
      "/central-de-ajuda/a/pedido-minimo",
    );
    expect(askSupportAssistant).toHaveBeenCalledWith("mypetbrasil", [
      { role: "user", content: "Qual o mínimo?" },
    ]);
  });

  it("as sugestões enviam a pergunta direto", async () => {
    askSupportAssistant.mockResolvedValue({ ok: true, reply: "Resposta." });
    render(<FaqAssistant channel="mypetbrasil" />);

    fireEvent.click(screen.getByRole("button", { name: "Qual é o pedido mínimo?" }));

    expect(await screen.findByText("Resposta.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Qual é o pedido mínimo?" })).toBeNull();
  });

  it("mostra o erro quando a API falha", async () => {
    askSupportAssistant.mockResolvedValue({ ok: false, error: "Tente novamente em instantes." });
    render(<FaqAssistant channel="mypetbrasil" />);

    fireEvent.change(screen.getByLabelText("Sua dúvida"), { target: { value: "Oi" } });
    fireEvent.click(screen.getByRole("button", { name: "Perguntar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Tente novamente em instantes.");
  });

  it("não envia pergunta vazia", () => {
    render(<FaqAssistant channel="mypetbrasil" />);
    fireEvent.click(screen.getByRole("button", { name: "Perguntar" }));
    expect(askSupportAssistant).not.toHaveBeenCalled();
  });
});
