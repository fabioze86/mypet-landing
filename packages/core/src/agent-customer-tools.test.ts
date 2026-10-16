import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";

vi.mock("./catalog-line-items", () => ({ queryLineItemsByIds: vi.fn() }));
vi.mock("./orders-server", () => ({ fetchRecentOrdersByBuyer: vi.fn() }));
vi.mock("./supabase", () => ({ getHubServiceClient: () => ({ __service: true }) }));

import { queryLineItemsByIds } from "./catalog-line-items";
import { fetchRecentOrdersByBuyer } from "./orders-server";
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

  it("produto repetido na mesma chamada: vale o último", async () => {
    (queryLineItemsByIds as Mock).mockResolvedValue([lineItem("v1")]);
    const out = await run("alterar_pedido", {
      itens: [
        { productId: "v1", quantidade: 3 },
        { productId: "v1", quantidade: 7 },
      ],
    });
    expect(out.aplicados).toEqual([expect.objectContaining({ id: "v1", qty: 7 })]);
  });

  it("falha ao consultar o catálogo vira erro", async () => {
    (queryLineItemsByIds as Mock).mockRejectedValue(new Error("down"));
    await expect(run("alterar_pedido", { itens: [{ productId: "v1", quantidade: 1 }] })).rejects.toThrow("down");
  });

  it("quantidade 0 é aplicada (tira do pedido)", async () => {
    (queryLineItemsByIds as Mock).mockResolvedValue([lineItem("v1", { variantLabel: null })]);
    const out = await run("alterar_pedido", { itens: [{ productId: "v1", quantidade: 0 }] });
    expect(out.aplicados).toEqual([expect.objectContaining({ id: "v1", name: "Shampoo Neutro", qty: 0 })]);
  });

  it("a descrição aceita ids do pedido atual e explica \"mais N\"", () => {
    const description = tools().alterar_pedido.description ?? "";
    expect(description).toContain("PEDIDO ATUAL DO CLIENTE");
    expect(description).toContain('"mais N" significa a quantidade atual no pedido + N');
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
    (fetchRecentOrdersByBuyer as Mock).mockResolvedValue([
      { id: "o1", status: "entregue", createdAt: "2026-08-16T12:00:00Z", items: [{ productId: "v1", name: "x", qty: 2 }] },
      { id: "o2", status: "entregue", createdAt: "2026-09-15T12:00:00Z", items: [{ productId: "v1", name: "x", qty: 3 }] },
    ]);
    (queryLineItemsByIds as Mock).mockResolvedValue([lineItem("v1")]);
    const out = await run("sugerir_reposicao", {});
    expect(fetchRecentOrdersByBuyer).toHaveBeenCalledWith({ __service: true }, "b1", { channel: "mypetbrasil", limit: 100 });
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

  it("falha ao consultar pedidos ou catálogo vira erro", async () => {
    (fetchRecentOrdersByBuyer as Mock).mockRejectedValue(new Error("down"));
    await expect(run("sugerir_reposicao", {})).rejects.toThrow("down");
    (fetchRecentOrdersByBuyer as Mock).mockResolvedValue([
      { id: "o1", status: "entregue", createdAt: "2026-10-01T12:00:00Z", items: [{ productId: "v1", name: "x", qty: 1 }] },
    ]);
    (queryLineItemsByIds as Mock).mockRejectedValue(new Error("catalogo"));
    await expect(run("sugerir_reposicao", {})).rejects.toThrow("catalogo");
  });

  it("descarta produtos ausentes ou sem preço antes de limitar a 8", async () => {
    const ids = Array.from({ length: 12 }, (_, i) => `v${i}`);
    (fetchRecentOrdersByBuyer as Mock).mockResolvedValue([
      {
        id: "o1",
        status: "entregue",
        createdAt: "2026-10-01T12:00:00Z",
        items: ids.map((productId) => ({ productId, name: "x", qty: 1 })),
      },
    ]);
    // v0 e v1 sem preço, v2 e v3 ausentes; v4..v11 válidos (8)
    (queryLineItemsByIds as Mock).mockResolvedValue([
      lineItem("v0", { unitPrice: null, priceLabel: null }),
      lineItem("v1", { unitPrice: null, priceLabel: null }),
      ...ids.slice(4).map((id) => lineItem(id)),
    ]);
    const out = await run("sugerir_reposicao", {});
    expect(out.itens).toHaveLength(8);
    expect(out.itens.every((i: { unitPrice: number | null }) => i.unitPrice != null)).toBe(true);
  });

  it("sem histórico não consulta o catálogo", async () => {
    (fetchRecentOrdersByBuyer as Mock).mockResolvedValue([]);
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
    // o limite é aplicado na consulta; o mock devolve o que o banco devolveria
    (fetchRecentOrdersByBuyer as Mock).mockResolvedValue(orders.slice(0, 5));
    const out = await run("status_pedidos", {});
    expect(out.pedidos).toHaveLength(5);
    expect(out.pedidos[0]).toEqual({ data: "08/10/2026", status: "confirmado", itens: 2, unidades: 5 });
    expect(fetchRecentOrdersByBuyer).toHaveBeenLastCalledWith({ __service: true }, "b1", { channel: "mypetbrasil", limit: 5 });
    (fetchRecentOrdersByBuyer as Mock).mockResolvedValue(orders.slice(0, 2));
    expect((await run("status_pedidos", { limite: 2 })).pedidos).toHaveLength(2);
    expect(fetchRecentOrdersByBuyer).toHaveBeenLastCalledWith({ __service: true }, "b1", { channel: "mypetbrasil", limit: 2 });
  });

  it("falha ao consultar os pedidos vira erro, não lista vazia", async () => {
    (fetchRecentOrdersByBuyer as Mock).mockRejectedValue(new Error("down"));
    await expect(run("status_pedidos", {})).rejects.toThrow("down");
  });
});

describe("saída para o modelo", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toModel = (name: "alterar_pedido" | "sugerir_reposicao", output: unknown) =>
    (tools()[name].toModelOutput as any)({ toolCallId: "t", input: {}, output });

  it("sugerir_reposicao: sem img nem sku", async () => {
    (fetchRecentOrdersByBuyer as Mock).mockResolvedValue([
      { id: "o1", status: "entregue", createdAt: "2026-08-16T12:00:00Z", items: [{ productId: "v1", name: "x", qty: 2 }] },
      { id: "o2", status: "entregue", createdAt: "2026-09-15T12:00:00Z", items: [{ productId: "v1", name: "x", qty: 3 }] },
    ]);
    (queryLineItemsByIds as Mock).mockResolvedValue([lineItem("v1")]);
    const out = toModel("sugerir_reposicao", await run("sugerir_reposicao", {}));
    expect(out).toEqual({
      type: "json",
      value: {
        tipo: "reposicao",
        itens: [
          { id: "v1", nome: "Shampoo Neutro — 5L", marca: "Pet Clean", preco: "R$ 89,90", ultimaCompraDias: 30, intervaloMedioDias: 30, qtdUltimaCompra: 3 },
        ],
      },
    });
    expect(JSON.stringify(out)).not.toMatch(/img|sku/);
  });

  it("alterar_pedido: aplicados resumidos e recusados", () => {
    const out = toModel("alterar_pedido", {
      aplicados: [{ id: "v1", name: "Shampoo — 5L", sku: "S", brand: "X", img: "/x.jpg", unitPrice: 89.9, qty: 2 }],
      recusados: [{ productId: "v2", motivo: "Produto não encontrado na tabela." }],
    });
    expect(out).toEqual({
      type: "json",
      value: {
        aplicados: [{ id: "v1", nome: "Shampoo — 5L", quantidade: 2, preco: 89.9 }],
        recusados: [{ productId: "v2", motivo: "Produto não encontrado na tabela." }],
      },
    });
    expect(JSON.stringify(out)).not.toMatch(/img|sku/);
  });
});
