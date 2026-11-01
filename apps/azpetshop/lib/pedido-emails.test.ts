import { describe, expect, it, vi } from "vitest";
import type { RetailOrderView } from "@mypet/core/retail-orders-server";
import { avisarPedidoPago, emailPedidoPagoCliente, emailPedidoPagoEquipe, pedidoParaEmail, type PedidoParaEmail } from "./pedido-emails";

const pedido: PedidoParaEmail = {
  id: "o1",
  number: 1042,
  customerName: "Maria Souza",
  customerEmail: "maria@exemplo.com",
  customerWhatsapp: "5511988887777",
  total: 70,
  shippingPrice: 20,
  items: [{ name: "Shampoo", qty: 2, unitPrice: 25 }],
  address: { cep: "20040002", logradouro: "Rua A", numero: "10", complemento: null, bairro: "Centro", cidade: "Rio de Janeiro", uf: "RJ" },
  serviceName: "Correios PAC",
  orderUrl: "https://www.azpetshop.com.br/pedido/o1?t=tok",
};

describe("e-mails de pedido", () => {
  it("equipe recebe número, itens, total, cliente e endereço", () => {
    const { subject, text } = emailPedidoPagoEquipe(pedido);
    expect(subject).toBe("Pedido 1042 pago — AZ Pet Shop");
    for (const trecho of ["2x Shampoo", "Maria Souza", "(11) 98888-7777", "Rua A, 10", "20040-002", "Correios PAC"]) {
      expect(text).toContain(trecho);
    }
  });

  it("cliente recebe confirmação com o link do pedido", () => {
    const { subject, text } = emailPedidoPagoCliente(pedido);
    expect(subject).toBe("Recebemos seu pagamento — pedido 1042");
    expect(text).toContain(pedido.orderUrl);
  });

  it("avisarPedidoPago manda para equipe e cliente e não lança se um falhar", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const mailer = vi.fn().mockRejectedValueOnce(new Error("smtp")).mockResolvedValueOnce(undefined);
    await expect(avisarPedidoPago(pedido, mailer, "pedidos@azpetshop.com.br")).resolves.toBeUndefined();
    expect(mailer).toHaveBeenCalledTimes(2);
    expect(mailer.mock.calls.map((c) => c[0].to)).toEqual(["pedidos@azpetshop.com.br", "maria@exemplo.com"]);
  });
});

describe("pedidoParaEmail", () => {
  const order: RetailOrderView = {
    id: "o1", number: 1042, status: "pago", createdAt: "2026-11-01T12:00:00Z",
    customerName: "Maria Souza", customerEmail: "maria@exemplo.com", customerWhatsapp: "5511988887777",
    subtotal: 50, shippingPrice: 20, total: 70,
    items: [{ name: "Shampoo", qty: 2, unitPrice: 25 }],
    shipping: { cep: "20040002", logradouro: "Rua A", numero: "10", complemento: null, bairro: "Centro", cidade: "Rio", uf: "RJ", serviceName: "Correios PAC", deliveryDays: 7, trackingCode: null },
    paymentUrl: null,
  };

  it("converte o pedido e monta o link com o token", () => {
    const p = pedidoParaEmail(order, "https://www.azpetshop.com.br", "tok");
    expect(p.orderUrl).toBe("https://www.azpetshop.com.br/pedido/o1?t=tok");
    expect(p.serviceName).toBe("Correios PAC");
    expect(p.address.cidade).toBe("Rio");
  });

  it("sem dados de entrega usa endereço e serviço vazios", () => {
    const p = pedidoParaEmail({ ...order, shipping: null }, "https://x", "t");
    expect(p.serviceName).toBe("");
    expect(p.address.cep).toBe("");
  });
});
