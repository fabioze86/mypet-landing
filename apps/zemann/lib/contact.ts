import { siteConfig } from "@/site.config";
import { isServiceKey, serviceSummary, type ServiceKey } from "./services";

export type ContactField = "nome" | "email" | "empresa" | "perfil" | "loja" | "servico" | "desafio";
export type ContactFormKind = "diagnostico" | "contato";

export type ContactInput = {
  form: ContactFormKind;
  nome: string;
  email: string;
  empresa: string;
  perfil: "marca" | "seller";
  loja: string;
  servico: ServiceKey | null;
  desafio: string;
};

type Values = Partial<Record<ContactField, string>>;
type Errors = Partial<Record<ContactField, string>>;

export type ContactState = {
  status: "idle" | "success" | "error";
  message: string;
  errors: Errors;
  values: Values;
  // Muda a cada envio; o formulário usa como key para remontar com os valores devolvidos.
  attempt: number;
};

export const INITIAL_CONTACT_STATE: ContactState = {
  status: "idle",
  message: "",
  errors: {},
  values: {},
  attempt: 0,
};

const FIELDS: ContactField[] = ["nome", "email", "empresa", "perfil", "loja", "servico", "desafio"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SUCCESS_MESSAGE = "Recebemos sua mensagem. Respondemos em até 1 dia útil.";

export function validateContact(
  formData: FormData,
): { ok: true; data: ContactInput; values: Values } | { ok: false; errors: Errors; values: Values } {
  const values: Values = {};
  for (const field of FIELDS) values[field] = String(formData.get(field) ?? "").trim();

  const errors: Errors = {};
  if (!values.nome) errors.nome = "Informe seu nome.";
  else if (values.nome.length > 120) errors.nome = "Use no máximo 120 caracteres.";
  if (!values.email || !EMAIL.test(values.email)) errors.email = "Informe um e-mail válido.";
  if (!values.empresa) errors.empresa = "Informe a empresa ou marca.";
  else if (values.empresa.length > 120) errors.empresa = "Use no máximo 120 caracteres.";
  if (values.perfil !== "marca" && values.perfil !== "seller") errors.perfil = "Escolha o seu perfil.";
  if (!values.desafio) errors.desafio = "Conte em poucas palavras o seu desafio.";
  else if (values.desafio.length > 2000) errors.desafio = "Use no máximo 2.000 caracteres.";
  if ((values.loja ?? "").length > 500) errors.loja = "Link muito longo.";
  // Opcional: vazio = "Ainda não sei"; preenchido, só vale chave do catálogo.
  if (values.servico && !isServiceKey(values.servico)) errors.servico = "Escolha um serviço da lista.";

  if (Object.keys(errors).length > 0) return { ok: false, errors, values };

  const kind = String(formData.get("form") ?? "");
  return {
    ok: true,
    values,
    data: {
      form: kind === "diagnostico" ? "diagnostico" : "contato",
      nome: values.nome!,
      email: values.email!,
      empresa: values.empresa!,
      perfil: values.perfil as "marca" | "seller",
      loja: values.loja ?? "",
      servico: values.servico ? (values.servico as ServiceKey) : null,
      desafio: values.desafio!,
    },
  };
}

export type OutgoingMail = { subject: string; text: string; replyTo: string };

export function formatContactEmail(data: ContactInput): OutgoingMail {
  const label = data.form === "diagnostico" ? "Diagnóstico da conta" : "Contato";
  const service = data.servico ? serviceSummary(data.servico).name : null;
  return {
    subject: `[Site] ${label}${service ? ` — ${service}` : ""} — ${data.empresa}`,
    replyTo: data.email,
    text: [
      `Formulário: ${label}`,
      `Nome: ${data.nome}`,
      `E-mail: ${data.email}`,
      `Empresa: ${data.empresa}`,
      `Perfil: ${data.perfil === "marca" ? "Marca/indústria" : "Loja, revenda ou seller"}`,
      ...(data.form === "contato" ? [`Serviço de interesse: ${service ?? "Ainda não sei"}`] : []),
      `Loja/produto: ${data.loja || "não informado"}`,
      "",
      "Desafio:",
      data.desafio,
    ].join("\n"),
  };
}

export function createSubmitContact(send: (mail: OutgoingMail) => Promise<void>) {
  return async function submit(prev: ContactState, formData: FormData): Promise<ContactState> {
    const attempt = prev.attempt + 1;

    // Honeypot: robôs preenchem o campo escondido; finge sucesso sem enviar.
    if (String(formData.get("website") ?? "").trim() !== "") {
      return { ...INITIAL_CONTACT_STATE, status: "success", message: SUCCESS_MESSAGE, attempt };
    }

    const result = validateContact(formData);
    if (!result.ok) {
      return {
        status: "error",
        message: "Confira os campos destacados.",
        errors: result.errors,
        values: result.values,
        attempt,
      };
    }

    try {
      await send(formatContactEmail(result.data));
    } catch (error) {
      console.error("[contato] falha ao enviar e-mail:", error instanceof Error ? error.message : error);
      return {
        status: "error",
        message: `Não foi possível enviar agora. Tente de novo em instantes ou escreva para ${siteConfig.email}.`,
        errors: {},
        values: result.values,
        attempt,
      };
    }

    return { status: "success", message: SUCCESS_MESSAGE, errors: {}, values: {}, attempt };
  };
}
