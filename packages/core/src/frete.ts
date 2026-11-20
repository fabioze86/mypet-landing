export type Zona = "bairros_proximos" | "capital" | "grande_sp" | "interior_30" | "interior_alem" | "fora";
export type RegraFrete = "zona" | "fabrica";
export type Modalidade = "normal" | "prioritaria";
export type FaixaCep = { de: string; ate: string };
export type TarifaZona = { minimoGratis: number | null; normal: number | null; prioritaria: number | null };
export type FreteConfig = {
  bairrosProximos: FaixaCep[];
  grandeSp: string[];
  interior30km: string[];
  zonas: Record<Zona, TarifaZona>;
  fabrica: { minimoGratis: number; fixo: number };
  prazoNormal: string;
};
export type FreteCalculo = {
  tipo: "gratis" | "fixo" | "a_combinar";
  modalidade: Modalidade;
  valorCentavos: number | null;
  faltaParaGratisCentavos: number | null;
  minimoGratisCentavos: number | null;
  prioritariaDisponivel: boolean;
  prazo: string | null;
};

export const ZONA_ROTULO: Record<Zona, string> = {
  bairros_proximos: "Bairros próximos (SP)",
  capital: "Capital de SP",
  grande_sp: "ABC e Grande SP",
  interior_30: "Interior até 30 km da capital",
  interior_alem: "Interior acima de 30 km da capital",
  fora: "Fora da área de entrega direta",
};

export const paraCentavos = (reais: number) => Math.round(reais * 100);

const normalizar = (v: string) =>
  v.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toUpperCase().replace(/\s+/g, " ");

export function classificarZona(
  loc: { uf: string | null; municipio: string | null; cep: string | null; status: "localizado" | "nao_localizado" | null },
  config: FreteConfig,
): Zona {
  if (loc.status !== "localizado") return "fora";
  const cep = (loc.cep ?? "").replace(/\D/g, "");
  if (cep.length === 8 && config.bairrosProximos.some((f) => cep >= f.de && cep <= f.ate)) return "bairros_proximos";
  const municipio = normalizar(loc.municipio ?? "");
  if (municipio === "SAO PAULO") return "capital";
  if (config.grandeSp.some((m) => normalizar(m) === municipio)) return "grande_sp";
  if (config.interior30km.some((m) => normalizar(m) === municipio)) return "interior_30";
  if ((loc.uf ?? "").trim().toUpperCase() === "SP") return "interior_alem";
  return "fora";
}

export function calcularFrete(
  input: { regra: RegraFrete; zona: Zona; subtotalCentavos: number; modalidade: Modalidade },
  config: FreteConfig,
): FreteCalculo {
  const { subtotalCentavos } = input;
  const falta = (minimo: number) => Math.max(minimo - subtotalCentavos, 0);

  if (input.regra === "fabrica") {
    const { minimoGratis, fixo } = config.fabrica;
    const gratis = subtotalCentavos >= minimoGratis;
    return {
      tipo: gratis ? "gratis" : "fixo",
      modalidade: "normal",
      valorCentavos: gratis ? 0 : fixo,
      faltaParaGratisCentavos: falta(minimoGratis),
      minimoGratisCentavos: minimoGratis,
      prioritariaDisponivel: false,
      prazo: null,
    };
  }

  const tarifa = config.zonas[input.zona];
  const prioritariaDisponivel = tarifa.prioritaria !== null;
  const base = {
    faltaParaGratisCentavos: tarifa.minimoGratis === null ? null : falta(tarifa.minimoGratis),
    minimoGratisCentavos: tarifa.minimoGratis,
    prioritariaDisponivel,
  };

  if (input.modalidade === "prioritaria" && tarifa.prioritaria !== null) {
    return { ...base, tipo: "fixo", modalidade: "prioritaria", valorCentavos: tarifa.prioritaria, prazo: "mesmo dia (pedidos até 12h)" };
  }
  if (tarifa.minimoGratis !== null && subtotalCentavos >= tarifa.minimoGratis) {
    return { ...base, tipo: "gratis", modalidade: "normal", valorCentavos: 0, prazo: config.prazoNormal };
  }
  if (tarifa.normal !== null) {
    return { ...base, tipo: "fixo", modalidade: "normal", valorCentavos: tarifa.normal, prazo: config.prazoNormal };
  }
  return { ...base, tipo: "a_combinar", modalidade: "normal", valorCentavos: null, prazo: null };
}

export function shippingModeDe(calc: FreteCalculo): "normal" | "prioritaria" | "a_combinar" {
  return calc.tipo === "a_combinar" ? "a_combinar" : calc.modalidade;
}
