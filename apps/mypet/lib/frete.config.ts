import type { FreteConfig } from "@mypet/core/frete";

// Valores em centavos. REVISAR COM O FÁBIO antes de publicar a Task 11:
// - bairrosProximos: faixas de CEP de Ipiranga, Sacomã, Cursino, Saúde, Vila Mariana e São João Clímaco.
//   Ponto de partida: 04000-000 a 04299-999 (zona sul próxima ao CD). Ajustar com a lista real de CEPs atendidos.
// - interior30km: rascunho; municípios de SP fora da Grande SP a até ~30 km da divisa da capital.
export const FRETE_CONFIG: FreteConfig = {
  bairrosProximos: [{ de: "04000000", ate: "04299999" }],
  grandeSp: [
    "Arujá", "Barueri", "Biritiba-Mirim", "Caieiras", "Cajamar", "Carapicuíba", "Cotia", "Diadema",
    "Embu das Artes", "Embu-Guaçu", "Ferraz de Vasconcelos", "Francisco Morato", "Franco da Rocha",
    "Guararema", "Guarulhos", "Itapecerica da Serra", "Itapevi", "Itaquaquecetuba", "Jandira", "Juquitiba",
    "Mairiporã", "Mauá", "Mogi das Cruzes", "Osasco", "Pirapora do Bom Jesus", "Poá", "Ribeirão Pires",
    "Rio Grande da Serra", "Salesópolis", "Santa Isabel", "Santana de Parnaíba", "Santo André",
    "São Bernardo do Campo", "São Caetano do Sul", "São Lourenço da Serra", "Suzano", "Taboão da Serra",
    "Vargem Grande Paulista",
  ],
  interior30km: [
    "Jundiaí", "Várzea Paulista", "Campo Limpo Paulista", "Jarinu", "Atibaia", "Bom Jesus dos Perdões",
    "Nazaré Paulista", "São Roque", "Araçariguama", "Cabreúva", "Itupeva", "Mairinque", "Ibiúna",
  ],
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
