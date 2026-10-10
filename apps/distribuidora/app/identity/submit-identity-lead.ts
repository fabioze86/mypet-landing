import type { Identity, IdentityField } from "@mypet/core/br-validation";

export type SubmitIdentityResult =
  | { kind: "ok" }
  | { kind: "invalid"; field?: IdentityField; error: string }
  | { kind: "failed" };

// Só 400 segura o pop-up; rede/5xx liberam o site (erro nosso não prende o cliente).
export async function submitIdentityLead(identity: Identity, fetchImpl: typeof fetch = fetch): Promise<SubmitIdentityResult> {
  try {
    const res = await fetchImpl("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(identity),
    });
    if (res.ok) return { kind: "ok" };
    const data = await res.json().catch(() => ({}));
    if (res.status === 400) {
      return {
        kind: "invalid",
        field: data.field === "nome" || data.field === "whatsapp" || data.field === "cnpj" ? data.field : undefined,
        error: typeof data.error === "string" ? data.error : "Confira os dados.",
      };
    }
    console.error("[identidade] falha ao gravar lead:", res.status, data?.error);
    return { kind: "failed" };
  } catch (error) {
    console.error("[identidade] falha ao gravar lead:", error);
    return { kind: "failed" };
  }
}
