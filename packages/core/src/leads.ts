export type LeadForm = {
  nome: string;
  empresa: string;
  whatsapp: string;
  cnpj?: string;
};

const GENERIC_CLIENT_ERROR = "Verifique os dados informados e tente novamente.";
const GENERIC_SERVER_ERROR = "Não foi possível salvar seu cadastro. Tente novamente em instantes.";
const NETWORK_ERROR = "Não foi possível conectar. Verifique sua internet e tente novamente.";

export async function submitLead(form: LeadForm): Promise<string | null> {
  let res: Response;
  try {
    res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
  } catch {
    return NETWORK_ERROR;
  }

  if (res.ok) return null;

  if (res.status >= 400 && res.status < 500) {
    const data = await res.json().catch(() => null);
    return typeof data?.error === "string" ? data.error : GENERIC_CLIENT_ERROR;
  }

  return GENERIC_SERVER_ERROR;
}
