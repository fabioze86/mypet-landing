import { describe, expect, it } from "vitest";
import { calcularFrete, classificarZona, shippingModeDe, paraCentavos, type FreteConfig } from "./frete";

const CONFIG: FreteConfig = {
  bairrosProximos: [{ de: "04200000", ate: "04299999" }],
  grandeSp: ["Santo André", "Guarulhos"],
  interior30km: ["Jundiaí"],
  zonas: {
    bairros_proximos: { minimoGratis: 9900, normal: 1299, prioritaria: 2500 },
    capital: { minimoGratis: 20000, normal: 2000, prioritaria: 3000 },
    grande_sp: { minimoGratis: 30000, normal: 2500, prioritaria: 3500 },
    interior_30: { minimoGratis: 40000, normal: null, prioritaria: null },
    interior_alem: { minimoGratis: 70000, normal: null, prioritaria: null },
    fora: { minimoGratis: null, normal: null, prioritaria: null },
  },
  fabrica: { minimoGratis: 29900, fixo: 1990 },
  prazoNormal: "12h a 48h",
};

const loc = (o: Partial<Parameters<typeof classificarZona>[0]>) =>
  ({ uf: "SP", municipio: "SAO PAULO", cep: "01001000", status: "localizado", ...o }) as Parameters<typeof classificarZona>[0];

describe("classificarZona", () => {
  it("CEP de bairro próximo vence o município", () => {
    expect(classificarZona(loc({ cep: "04210000" }), CONFIG)).toBe("bairros_proximos");
  });
  it("capital pelo município, sem ligar para acento e caixa", () => {
    expect(classificarZona(loc({ municipio: " São Paulo " }), CONFIG)).toBe("capital");
  });
  it("grande SP pela lista", () => {
    expect(classificarZona(loc({ municipio: "SANTO ANDRE", cep: "09000000" }), CONFIG)).toBe("grande_sp");
  });
  it("interior até 30 km pela lista", () => {
    expect(classificarZona(loc({ municipio: "JUNDIAI", cep: "13200000" }), CONFIG)).toBe("interior_30");
  });
  it("outro município de SP é interior além", () => {
    expect(classificarZona(loc({ municipio: "CAMPINAS", cep: "13000000" }), CONFIG)).toBe("interior_alem");
  });
  it("outra UF, não localizado e pendente caem em fora", () => {
    expect(classificarZona(loc({ uf: "RJ", municipio: "RIO DE JANEIRO" }), CONFIG)).toBe("fora");
    expect(classificarZona(loc({ status: "nao_localizado" }), CONFIG)).toBe("fora");
    expect(classificarZona(loc({ status: null }), CONFIG)).toBe("fora");
  });
  it("município de mesmo nome em outra UF cai em fora", () => {
    expect(classificarZona(loc({ uf: "PA", municipio: "Santo André", cep: "68000000" }), CONFIG)).toBe("fora");
    expect(classificarZona(loc({ uf: "RN", municipio: "Jundiaí", cep: "59000000" }), CONFIG)).toBe("fora");
  });
  it("aceita CEP com máscara e nome com hífen sem acento", () => {
    expect(classificarZona(loc({ cep: "04210-000" }), CONFIG)).toBe("bairros_proximos");
    expect(classificarZona(loc({ municipio: "EMBU-GUACU", cep: "06900000" }), { ...CONFIG, grandeSp: ["Embu-Guaçu"] })).toBe("grande_sp");
  });
});

describe("calcularFrete — fábrica", () => {
  const f = (subtotalCentavos: number, zona: Parameters<typeof calcularFrete>[0]["zona"] = "fora") =>
    calcularFrete({ regra: "fabrica", zona, subtotalCentavos, modalidade: "normal" }, CONFIG);

  it("abaixo de R$ 299 paga R$ 19,90 e mostra quanto falta", () => {
    expect(f(29899)).toMatchObject({ tipo: "fixo", valorCentavos: 1990, faltaParaGratisCentavos: 1, minimoGratisCentavos: 29900 });
  });
  it("exatamente R$ 299 é grátis", () => {
    expect(f(29900)).toMatchObject({ tipo: "gratis", valorCentavos: 0, faltaParaGratisCentavos: 0 });
  });
  it("vale igual em qualquer zona e nunca tem prioritária", () => {
    expect(f(10000, "capital")).toMatchObject({ tipo: "fixo", valorCentavos: 1990, prioritariaDisponivel: false });
    expect(calcularFrete({ regra: "fabrica", zona: "capital", subtotalCentavos: 10000, modalidade: "prioritaria" }, CONFIG).modalidade).toBe("normal");
  });
});

describe("calcularFrete — catálogo completo", () => {
  const c = (zona: Parameters<typeof calcularFrete>[0]["zona"], subtotalCentavos: number, modalidade: "normal" | "prioritaria" = "normal") =>
    calcularFrete({ regra: "zona", zona, subtotalCentavos, modalidade }, CONFIG);

  it("capital abaixo do mínimo paga a normal", () => {
    expect(c("capital", 19999)).toMatchObject({ tipo: "fixo", valorCentavos: 2000, faltaParaGratisCentavos: 1, prazo: "12h a 48h" });
  });
  it("capital no mínimo é grátis", () => {
    expect(c("capital", 20000)).toMatchObject({ tipo: "gratis", valorCentavos: 0 });
  });
  it("prioritária é paga mesmo com a normal grátis", () => {
    expect(c("bairros_proximos", 50000, "prioritaria")).toMatchObject({ tipo: "fixo", modalidade: "prioritaria", valorCentavos: 2500 });
  });
  it("prioritária só em bairros próximos, capital e grande SP", () => {
    expect(c("grande_sp", 100, "prioritaria")).toMatchObject({ modalidade: "prioritaria", valorCentavos: 3500, prioritariaDisponivel: true });
    expect(c("interior_30", 100, "prioritaria")).toMatchObject({ modalidade: "normal", prioritariaDisponivel: false });
  });
  it("interior abaixo do mínimo é a combinar; acima é grátis", () => {
    expect(c("interior_30", 39999)).toMatchObject({ tipo: "a_combinar", valorCentavos: null, prazo: null, faltaParaGratisCentavos: 1 });
    expect(c("interior_alem", 70000)).toMatchObject({ tipo: "gratis", valorCentavos: 0 });
  });
  it("fora é sempre a combinar, sem mínimo", () => {
    expect(c("fora", 999999)).toMatchObject({ tipo: "a_combinar", minimoGratisCentavos: null, faltaParaGratisCentavos: null });
  });
});

describe("auxiliares", () => {
  it("shippingModeDe", () => {
    expect(shippingModeDe(calcularFrete({ regra: "zona", zona: "fora", subtotalCentavos: 1, modalidade: "normal" }, CONFIG))).toBe("a_combinar");
    expect(shippingModeDe(calcularFrete({ regra: "zona", zona: "capital", subtotalCentavos: 1, modalidade: "prioritaria" }, CONFIG))).toBe("prioritaria");
  });
  it("paraCentavos arredonda", () => {
    expect(paraCentavos(19.9)).toBe(1990);
    expect(paraCentavos(0.1 + 0.2)).toBe(30);
  });
});
