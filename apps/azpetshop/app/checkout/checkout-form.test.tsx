import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const cotarFrete = vi.fn();
const iniciarPagamento = vi.fn();
vi.mock("./actions", () => ({
  cotarFrete: (...a: unknown[]) => cotarFrete(...a),
  iniciarPagamento: (...a: unknown[]) => iniciarPagamento(...a),
}));
const cart = { items: [{ id: "11111111-1111-4111-8111-111111111111", name: "Shampoo", sku: "S", brand: null, img: "/s.jpg", qty: 2, unitPrice: 25 }] };
vi.mock("@mypet/core/components/cart-provider", () => ({ useCart: () => ({ cart, clear: vi.fn() }) }));

import { CheckoutForm } from "./checkout-form";

beforeEach(() => {
  cotarFrete.mockReset();
  iniciarPagamento.mockReset();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ logradouro: "Praça da Sé", bairro: "Sé", localidade: "São Paulo", uf: "SP" }))));
});

describe("CheckoutForm", () => {
  it("busca o endereço pelo CEP, cota o frete e mostra as opções com o total", async () => {
    cotarFrete.mockResolvedValue({ ok: true, subtotal: 50, options: [{ serviceId: 1, name: "PAC", company: "Correios", price: 20, deliveryDays: 7 }] });
    render(<CheckoutForm />);
    fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "01001-000" } });
    fireEvent.click(screen.getByRole("button", { name: "Calcular frete" }));
    await waitFor(() => expect(screen.getByLabelText(/Correios PAC/)).toBeInTheDocument());
    expect((screen.getByLabelText("Rua") as HTMLInputElement).value).toBe("Praça da Sé");
    fireEvent.click(screen.getByLabelText(/Correios PAC/));
    expect(screen.getByText(/Total/).parentElement).toHaveTextContent("70,00");
  });

  it("mostra o erro do servidor ao pagar", async () => {
    cotarFrete.mockResolvedValue({ ok: true, subtotal: 50, options: [{ serviceId: 1, name: "PAC", company: "Correios", price: 20, deliveryDays: 7 }] });
    iniciarPagamento.mockResolvedValue({ ok: false, error: "Informe um CPF válido." });
    render(<CheckoutForm />);
    fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "01001000" } });
    fireEvent.click(screen.getByRole("button", { name: "Calcular frete" }));
    await waitFor(() => screen.getByLabelText(/Correios PAC/));
    fireEvent.click(screen.getByLabelText(/Correios PAC/));
    const preencher = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
    preencher("Nome completo", "Maria Souza");
    preencher("CPF", "529.982.247-25");
    preencher("E-mail", "m@x.com");
    preencher("WhatsApp", "11988887777");
    preencher("Número", "1");
    preencher("Cidade", "São Paulo");
    fireEvent.click(screen.getByRole("button", { name: "Ir para o pagamento" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Informe um CPF válido."));
  });
});
