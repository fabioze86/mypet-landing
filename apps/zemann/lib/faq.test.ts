import { describe, expect, it } from "vitest";
import { AGENCY_FAQ, AMAZON_FAQ } from "./faq";

const ALL = [...AGENCY_FAQ, ...AMAZON_FAQ];

describe("FAQ", () => {
  it("tem perguntas únicas nos dois blocos, terminadas em interrogação e com resposta", () => {
    const questions = ALL.map((item) => item.q);
    expect(new Set(questions).size).toBe(questions.length);
    for (const item of ALL) {
      expect(item.q.endsWith("?")).toBe(true);
      expect(item.a.length).toBeGreaterThan(40);
    }
  });

  it("bloco da agência apresenta os serviços e não diz que o foco é só a Amazon", () => {
    expect(AGENCY_FAQ[0].a).toContain("agência de crescimento");
    for (const item of ALL) expect(item.a).not.toContain("exclusivamente a Amazon");
  });

  it("não cita selos que a Zemann não tem", () => {
    const text = JSON.stringify(ALL).toLowerCase();
    for (const word of ["partner", "parceiro oficial", "parceira oficial"]) expect(text).not.toContain(word);
  });
});
