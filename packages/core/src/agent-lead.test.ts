import { describe, it, expect } from "vitest";
import { LEAD_NAME_MAX, LEAD_WHATSAPP_MAX, normalizeAgentLead } from "./agent-lead";

describe("normalizeAgentLead", () => {
  it("aceita nome e WhatsApp, numa linha e sem espaços nas pontas", () => {
    expect(normalizeAgentLead({ nome: "  Ana \n Souza ", whatsapp: " (11) 99999-0000 " })).toEqual({
      nome: "Ana Souza",
      whatsapp: "(11) 99999-0000",
    });
  });

  it("aceita \"não\" como resposta do WhatsApp", () => {
    expect(normalizeAgentLead({ nome: "Ana", whatsapp: "não" })).toEqual({ nome: "Ana", whatsapp: "não" });
  });

  it("corta nos limites", () => {
    const lead = normalizeAgentLead({ nome: "a".repeat(200), whatsapp: "9".repeat(200) });
    expect(lead?.nome).toHaveLength(LEAD_NAME_MAX);
    expect(lead?.whatsapp).toHaveLength(LEAD_WHATSAPP_MAX);
  });

  it("recusa vazio, tipo errado ou ausente", () => {
    expect(normalizeAgentLead({ nome: "   ", whatsapp: "não" })).toBeNull();
    expect(normalizeAgentLead({ nome: "Ana", whatsapp: "" })).toBeNull();
    expect(normalizeAgentLead({ nome: 1, whatsapp: "não" })).toBeNull();
    expect(normalizeAgentLead(null)).toBeNull();
    expect(normalizeAgentLead("Ana")).toBeNull();
  });
});
