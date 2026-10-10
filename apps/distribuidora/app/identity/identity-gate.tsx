"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useClientConfig } from "@mypet/core/theme";
import { formatCnpj, formatWhatsapp, validateIdentity, type Identity, type IdentityField } from "@mypet/core/br-validation";
import { saveIdentity, useIdentity } from "./identity-store";
import { submitIdentityLead } from "./submit-identity-lead";

type IdentityGateValue = { openIdentityGate: () => void };
const IdentityGateContext = createContext<IdentityGateValue | null>(null);

export function useIdentityGate(): IdentityGateValue {
  const ctx = useContext(IdentityGateContext);
  if (!ctx) throw new Error("useIdentityGate deve ser usado dentro de IdentityGateProvider");
  return ctx;
}

// Pop-up obrigatório na primeira visita (sem identidade salva); reabre por "Alterar dados".
export function IdentityGateProvider({ children }: { children: React.ReactNode }) {
  const identity = useIdentity();
  const [editing, setEditing] = useState(false);
  const required = identity === null;
  const open = required || editing;

  return (
    <IdentityGateContext.Provider value={{ openIdentityGate: () => setEditing(true) }}>
      {children}
      {open && (
        <IdentityDialog
          initial={identity ?? null}
          dismissible={!required}
          onDone={() => setEditing(false)}
        />
      )}
    </IdentityGateContext.Provider>
  );
}

function IdentityDialog({
  initial,
  dismissible,
  onDone,
}: {
  initial: Identity | null;
  dismissible: boolean;
  onDone: () => void;
}) {
  const { palette, name } = useClientConfig();
  const [form, setForm] = useState({
    nome: initial?.nome ?? "",
    whatsapp: initial ? formatWhatsapp(initial.whatsapp) : "",
    cnpj: initial?.cnpj ? formatCnpj(initial.cnpj) : "",
  });
  const [errors, setErrors] = useState<Partial<Record<IdentityField, string>>>({});
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sending) return;
    const parsed = validateIdentity(form);
    if (!parsed.ok) {
      setErrors({ [parsed.field]: parsed.error });
      return;
    }
    setErrors({});
    setSending(true);
    const result = await submitIdentityLead(parsed.value);
    if (result.kind === "invalid") {
      setErrors(result.field ? { [result.field]: result.error } : { nome: result.error });
      setSending(false);
      return;
    }
    saveIdentity(parsed.value);
    setSending(false);
    onDone();
  };

  const input: React.CSSProperties = {
    width: "100%",
    padding: "12px 14px",
    border: `1.5px solid ${palette.gray200}`,
    borderRadius: 10,
    fontSize: 16,
    color: palette.gray800,
    outline: "none",
  };
  const label: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 700, color: palette.navy, marginBottom: 6 };
  const errorStyle: React.CSSProperties = { color: palette.orange, fontSize: 12, marginTop: 4 };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(15,31,69,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="identity-gate-title"
        style={{ background: palette.white, borderRadius: 20, padding: "28px 22px", width: "100%", maxWidth: 420, fontFamily: "var(--font-nunito), sans-serif" }}
      >
        <h2 id="identity-gate-title" style={{ fontSize: 22, fontWeight: 900, color: palette.navy, marginBottom: 6 }}>
          Acesse o catálogo
        </h2>
        <p style={{ fontSize: 14, color: palette.gray600, marginBottom: 20 }}>
          Informe seus dados para ver os produtos da {name} e fechar pedidos pelo WhatsApp.
        </p>
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="identity-nome" style={label}>Seu nome</label>
            <input
              id="identity-nome"
              autoFocus
              autoComplete="name"
              value={form.nome}
              onChange={(event) => setForm((current) => ({ ...current, nome: event.target.value }))}
              style={input}
            />
            {errors.nome && <p role="alert" style={errorStyle}>{errors.nome}</p>}
          </div>
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="identity-whatsapp" style={label}>WhatsApp com DDD</label>
            <input
              id="identity-whatsapp"
              inputMode="tel"
              autoComplete="tel-national"
              value={form.whatsapp}
              onChange={(event) => setForm((current) => ({ ...current, whatsapp: formatWhatsapp(event.target.value) }))}
              style={input}
            />
            {errors.whatsapp && <p role="alert" style={errorStyle}>{errors.whatsapp}</p>}
          </div>
          <div style={{ marginBottom: 20 }}>
            <label htmlFor="identity-cnpj" style={label}>CNPJ (opcional)</label>
            <input
              id="identity-cnpj"
              inputMode="numeric"
              value={form.cnpj}
              onChange={(event) => setForm((current) => ({ ...current, cnpj: formatCnpj(event.target.value) }))}
              style={input}
            />
            {errors.cnpj && <p role="alert" style={errorStyle}>{errors.cnpj}</p>}
          </div>
          <button
            type="submit"
            disabled={sending}
            style={{
              width: "100%",
              padding: 14,
              background: palette.pink,
              color: palette.white,
              border: "none",
              borderRadius: 10,
              fontFamily: "inherit",
              fontSize: 16,
              fontWeight: 800,
              cursor: sending ? "default" : "pointer",
              opacity: sending ? 0.7 : 1,
            }}
          >
            {sending ? "Salvando…" : "Acessar catálogo"}
          </button>
        </form>
        {dismissible && (
          <button
            type="button"
            onClick={onDone}
            style={{ display: "block", margin: "14px auto 0", background: "none", border: "none", color: palette.gray400, fontSize: 13, cursor: "pointer" }}
          >
            Fechar
          </button>
        )}
      </div>
    </div>
  );
}
