import { describe, it, expect, vi, beforeEach } from "vitest";

const requireBuyer = vi.fn();
const agendarLocalizacao = vi.fn();
const getCategoriesWithProducts = vi.fn(async () => [{ id: "c1", name: "Cães", slug: "caes", parentId: null, level: 0, sortOrder: 0 }]);
const redirect = vi.fn((_to: string) => {
  throw new Error("REDIRECT");
});
const notFound = vi.fn(() => {
  throw new Error("NOT_FOUND");
});

vi.mock("@/lib/require-buyer", () => ({ requireBuyer: () => requireBuyer() }));
vi.mock("@/lib/localizacao", () => ({ agendarLocalizacao: (b: unknown) => agendarLocalizacao(b) }));
vi.mock("next/navigation", () => ({ redirect: (to: string) => redirect(to), notFound: () => notFound() }));
vi.mock("@mypet/core/catalog", () => ({
  getCategoriesWithProducts: (...a: unknown[]) => getCategoriesWithProducts(...(a as [])),
}));

import { VitrinePageBody } from "./vitrine-page";
import { VITRINES } from "@/lib/vitrines";

const BUYER = { id: "b1", nome: "Ana", empresa: null, whatsapp: "1", cnpj: null, email: null, uf: null, municipio: null, cep: null, localizacao_status: null };
const sp = Promise.resolve({});

beforeEach(() => {
  requireBuyer.mockReset();
  redirect.mockClear();
  notFound.mockClear();
  agendarLocalizacao.mockClear();
  getCategoriesWithProducts.mockClear();
});

describe("VitrinePageBody", () => {
  it("sem comprador, manda para o cadastro com volta para a vitrine", async () => {
    requireBuyer.mockResolvedValue(null);
    await expect(VitrinePageBody({ vitrine: VITRINES.fabrica, searchParams: sp })).rejects.toThrow("REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/cadastro?next=%2Ffabrica");
  });

  it("agenda a localização e busca categorias com o recorte da fábrica", async () => {
    requireBuyer.mockResolvedValue(BUYER);
    await VitrinePageBody({ vitrine: VITRINES.fabrica, searchParams: sp });
    expect(agendarLocalizacao).toHaveBeenCalledWith(BUYER);
    expect(getCategoriesWithProducts).toHaveBeenCalledWith("mypetbrasil", "ffa_fabrica");
  });

  it("categoria inexistente dá 404", async () => {
    requireBuyer.mockResolvedValue(BUYER);
    await expect(VitrinePageBody({ vitrine: VITRINES.fabrica, searchParams: sp, categoriaSlug: "xpto" })).rejects.toThrow("NOT_FOUND");
  });
});
