import { describe, expect, it } from "vitest";
import { formatWhatsapp } from "@mypet/core/br-validation";
import { EMPRESA } from "./empresa";
import { POLITICAS, getPolitica } from "./politicas";

describe("POLITICAS", () => {
  it("tem as 4 políticas exigidas, nesta ordem", () => {
    expect(POLITICAS.map((p) => p.slug)).toEqual(["troca-e-devolucao", "privacidade", "entrega", "pagamento"]);
  });

  it("toda política tem título, resumo e seções com texto", () => {
    for (const p of POLITICAS) {
      expect(p.titulo.length).toBeGreaterThan(5);
      expect(p.resumo.length).toBeGreaterThan(20);
      expect(p.secoes.length).toBeGreaterThan(0);
      for (const s of p.secoes) expect(s.paragrafos.join("").length).toBeGreaterThan(20);
    }
  });

  it("troca e devolução informa e-mail e WhatsApp formatado", () => {
    const texto = JSON.stringify(getPolitica("troca-e-devolucao"));
    expect(texto).toContain(EMPRESA.email);
    expect(texto).toContain(formatWhatsapp(EMPRESA.whatsapp));
  });

  it("troca e devolução cita o prazo de 7 dias do CDC", () => {
    expect(JSON.stringify(getPolitica("troca-e-devolucao"))).toContain("7 (sete) dias");
  });

  it("privacidade identifica o controlador pelo CNPJ e cita a LGPD", () => {
    const texto = JSON.stringify(getPolitica("privacidade"));
    expect(texto).toContain(EMPRESA.razaoSocial);
    expect(texto).toContain("13.709/2018");
  });

  it("getPolitica devolve undefined para slug desconhecido", () => {
    expect(getPolitica("nao-existe")).toBeUndefined();
  });
});
