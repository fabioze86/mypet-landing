import { describe, expect, it, vi } from "vitest";
import {
  INITIAL_CONTACT_STATE,
  createSubmitContact,
  formatContactEmail,
  validateContact,
} from "./contact";

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const valid = {
  form: "diagnostico",
  nome: "Ana",
  email: "ana@marca.com.br",
  empresa: "Marca X",
  perfil: "marca",
  loja: "",
  desafio: "Nossos anúncios estão com pendência e não vendem.",
};

describe("validateContact", () => {
  it("aceita dados válidos", () => {
    const result = validateContact(form(valid));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toMatchObject({ form: "diagnostico", perfil: "marca", empresa: "Marca X" });
  });

  it("limita nome e empresa a 120 caracteres", () => {
    const long = "a".repeat(121);
    const result = validateContact(form({ ...valid, nome: long, empresa: long }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.nome).toBe("Use no máximo 120 caracteres.");
      expect(result.errors.empresa).toBe("Use no máximo 120 caracteres.");
    }
    expect(validateContact(form({ ...valid, nome: "a".repeat(120), empresa: "a".repeat(120) })).ok).toBe(true);
  });

  it("exige o desafio", () => {
    const result = validateContact(form({ ...valid, desafio: "" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.desafio).toBe("Conte em poucas palavras o seu desafio.");
  });

  it("recusa e-mail inválido e perfil desconhecido", () => {
    const result = validateContact(form({ ...valid, email: "ana", perfil: "outro" }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.email).toBeDefined();
      expect(result.errors.perfil).toBeDefined();
    }
  });

  it("devolve os valores digitados para não perder o que foi preenchido", () => {
    const result = validateContact(form({ ...valid, nome: "" }));
    expect(result.values.empresa).toBe("Marca X");
  });

  it("formulário desconhecido vira contato", () => {
    const result = validateContact(form({ ...valid, form: "x" }));
    expect(result.ok && result.data.form).toBe("contato");
  });
});

describe("formatContactEmail", () => {
  it("monta assunto pelo tipo de formulário e responde para o lead", () => {
    const result = validateContact(form(valid));
    if (!result.ok) throw new Error("inválido");
    const mail = formatContactEmail(result.data);
    expect(mail.subject).toBe("[Site] Diagnóstico da conta — Marca X");
    expect(mail.replyTo).toBe("ana@marca.com.br");
    expect(mail.text).toContain("Desafio:");
  });
});

describe("createSubmitContact", () => {
  it("envia e devolve sucesso", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const state = await createSubmitContact(send)(INITIAL_CONTACT_STATE, form(valid));
    expect(send).toHaveBeenCalledOnce();
    expect(state.status).toBe("success");
    expect(state.attempt).toBe(1);
  });

  it("não envia quando a validação falha", async () => {
    const send = vi.fn();
    const state = await createSubmitContact(send)(INITIAL_CONTACT_STATE, form({ ...valid, desafio: "" }));
    expect(send).not.toHaveBeenCalled();
    expect(state.status).toBe("error");
    expect(state.errors.desafio).toBeDefined();
  });

  it("falha no SMTP vira erro visível e mantém os dados", async () => {
    const send = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const state = await createSubmitContact(send)(INITIAL_CONTACT_STATE, form(valid));
    expect(state.status).toBe("error");
    expect(state.message).toContain("contato@zemann.com.br");
    expect(state.values.empresa).toBe("Marca X");
  });

  it("honeypot preenchido finge sucesso sem enviar", async () => {
    const send = vi.fn();
    const state = await createSubmitContact(send)(INITIAL_CONTACT_STATE, form({ ...valid, website: "spam.com" }));
    expect(send).not.toHaveBeenCalled();
    expect(state.status).toBe("success");
  });
});
