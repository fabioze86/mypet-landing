import { describe, expect, it, vi, beforeEach } from "vitest";

const after = vi.fn((cb: () => unknown) => cb());
const localizarComprador = vi.fn(async () => {});

vi.mock("next/server", () => ({ after: (cb: () => unknown) => after(cb) }));
vi.mock("@mypet/core/supabase", () => ({ getHubServiceClient: () => ({ hub: true }) }));
vi.mock("@mypet/core/buyers-server", () => ({
  localizarComprador: (...args: unknown[]) => localizarComprador(...(args as [])),
}));

import { agendarLocalizacao } from "./localizacao";

beforeEach(() => {
  after.mockClear();
  localizarComprador.mockClear();
});

describe("agendarLocalizacao", () => {
  it("agenda a consulta para comprador pendente", () => {
    const buyer = { id: "u1", cnpj: "12345678000199", localizacao_status: null };
    agendarLocalizacao(buyer);
    expect(after).toHaveBeenCalledTimes(1);
    expect(localizarComprador).toHaveBeenCalledWith({ hub: true }, buyer);
  });

  it("não agenda para quem já tem status", () => {
    agendarLocalizacao({ id: "u1", cnpj: "1", localizacao_status: "nao_localizado" });
    expect(after).not.toHaveBeenCalled();
  });
});
