import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";

vi.mock("./catalog-line-items", () => ({ queryLineItemsByIds: vi.fn() }));
vi.mock("./orders-server", () => ({ getOrdersByBuyer: vi.fn() }));
vi.mock("./supabase", () => ({ getHubServiceClient: () => ({ __service: true }) }));

import { queryLineItemsByIds } from "./catalog-line-items";
import { getOrdersByBuyer } from "./orders-server";
import { buildCustomerTools } from "./agent-customer-tools";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Execute = (input: any, options: any) => Promise<any>;
const opts = { toolCallId: "t1", messages: [] };
const tools = () => buildCustomerTools({ channel: "mypetbrasil", buyerId: "b1" });
const run = (name: "alterar_pedido" | "sugerir_reposicao" | "status_pedidos", input: unknown) =>
  (tools()[name].execute as Execute)(input, opts);

const lineItem = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  name: "Shampoo Neutro",
  sku: `SKU-${id}`,
  brand: "Pet Clean",
  img: "/x.jpg",
  unitPrice: 89.9,
  priceLabel: "R$ 89,90",
  variantLabel: "5L",
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-15T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("alterar_pedido", () => {
  it("aplica produtos com preço e recusa os desconhecidos ou sem preço", async () => {
    (queryLineItemsByIds as Mock).mockResolvedValue([lineItem("v1"), lineItem("v2", { unitPrice: null, priceLabel: null })]);
    const out = await run("alterar_pedido", {
      itens: [
        { productId: "v1", quantidade: 10 },
        { productId: "v2", quantidade: 1 },
        { productId: "zz", quantidade: 2 },
      ],
    });
    expect(queryLineItemsByIds).toHaveBeenCalledWith(["v1", "v2", "zz"], "mypetbrasil");
    expect(out.aplicados).toEqual([
      { id: "v1", name: "Shampoo Neutro — 5L", sku: "SKU-v1", brand: "Pet Clean", img: "/x.jpg", unitPrice: 89.9, qty: 10 },
    ]);
    expect(out.recusados).toEqual([
      { productId: "v2", motivo: "Produto sem preço na tabela no momento." },
      { productId: "zz", motivo: "Produto não encontrado na tabela." },
    ]);
  });

  it("quantidade 0 é aplicada (tira do pedido)", async () => {
    (queryLineItemsByIds as Mock).mockResolvedValue([lineItem("v1", { variantLabel: null })]);
    const out = await run("alterar_pedido", { itens: [{ productId: "v1", quantidade: 0 }] });
    expect(out.aplicados).toEqual([expect.objectContaining({ id: "v1", name: "Shampoo Neutro", qty: 0 })]);
  });

  it("o esquema limita itens e quantidades", () => {
    const schema = tools().alterar_pedido.inputSchema as { safeParse: (v: unknown) => { success: boolean } };
    expect(schema.safeParse({ itens: [{ productId: "a", quantidade: 10000 }] }).success).toBe(false);
    expect(schema.safeParse({ itens: [{ productId: "a", quantidade: 1.5 }] }).success).toBe(false);
    expect(schema.safeParse({ itens: [] }).success).toBe(false);
    expect(
      schema.safeParse({ itens: Array.from({ length: 21 }, (_, i) => ({ productId: `p${i}`, quantidade: 1 })) }).success,
    ).toBe(false);
  });
});

describe("sugerir_reposicao", () => {
  it("usa só os pedidos do comprador do cookie e devolve cartões com preço atual", async () => {
    (getOrdersByBuyer as Mock).mockResolvedValue([
      { id: "o1", status: "entregue", createdAt: "2026-08-16T12:00:00Z", items: [{ productId: "v1", name: "x", qty: 2 }] },
      { id: "o2", status: "entregue", createdAt: "2026-09-15T12:00:00Z", items: [{ productId: "v1", name: "x", qty: 3 }] },
    ]);
    (queryLineItemsByIds as Mock).mockResolvedValue([lineItem("v1")]);
    const out = await run("sugerir_reposicao", {});
    expect(getOrdersByBuyer).toHaveBeenCalledWith({ __service: true }, "b1");
    expect(out).toEqual({
      tipo: "reposicao",
      itens: [
        {
          id: "v1",
          name: "Shampoo Neutro",
          sku: "SKU-v1",
          brand: "Pet Clean",
          variantLabel: "5L",
          img: "/x.jpg",
          unitPrice: 89.9,
          priceLabel: "R$ 89,90",
          ultimaCompraDias: 30,
          intervaloMedioDias: 30,
          qtdUltimaCompra: 3,
        },
      ],
    });
  });

  it("sem histórico não consulta o catálogo", async () => {
    (getOrdersByBuyer as Mock).mockResolvedValue([]);
    expect(await run("sugerir_reposicao", {})).toEqual({ tipo: "sem_historico", itens: [] });
    expect(queryLineItemsByIds).not.toHaveBeenCalled();
  });
});

describe("status_pedidos", () => {
  it("resume os últimos pedidos do comprador (padrão 5)", async () => {
    const orders = Array.from({ length: 7 }, (_, i) => ({
      id: `o${i}`,
      status: i === 0 ? "confirmado" : "entregue",
      createdAt: "2026-10-08T15:00:00Z",
      items: [
        { productId: "a", name: "A", qty: 2 },
        { productId: "b", name: "B", qty: 3 },
      ],
    }));
    (getOrdersByBuyer as Mock).mockResolvedValue(orders);
    const out = await run("status_pedidos", {});
    expect(out.pedidos).toHaveLength(5);
    expect(out.pedidos[0]).toEqual({ data: "08/10/2026", status: "confirmado", itens: 2, unidades: 5 });
    expect((await run("status_pedidos", { limite: 2 })).pedidos).toHaveLength(2);
  });
});
