"use client";

import { useState } from "react";

const GENERIC_ERROR = "Não foi possível liberar seu acesso agora. Tente novamente em instantes.";
type Field = "cnpj" | "whatsapp" | "email";
type FieldErrors = Partial<Record<Field, string>>;

export function AccessForm() {
  const [cnpj, setCnpj] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  function clearFieldError(field: Field) {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setFieldErrors({});
    try {
      const response = await fetch("/api/pre-acesso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cnpj, whatsapp, email }),
      });
      if (response.ok) {
        window.location.assign("/loja");
        return;
      }
      const data = await response.json().catch(() => null);
      const field = data?.error?.field as Field | undefined;
      if (field && data?.error?.message) {
        setFieldErrors({ [field]: data.error.message });
      } else {
        setError(data?.error?.message ?? GENERIC_ERROR);
      }
    } catch {
      setError(GENERIC_ERROR);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form id="criar-acesso" onSubmit={handleSubmit} noValidate>
      <label htmlFor="pa-cnpj">CNPJ</label>
      <input
        id="pa-cnpj"
        name="cnpj"
        autoComplete="organization"
        required
        value={cnpj}
        onChange={(e) => {
          setCnpj(e.target.value);
          clearFieldError("cnpj");
        }}
        aria-invalid={Boolean(fieldErrors.cnpj)}
        aria-describedby={fieldErrors.cnpj ? "pa-cnpj-error" : undefined}
      />
      {fieldErrors.cnpj ? <p id="pa-cnpj-error" role="alert">{fieldErrors.cnpj}</p> : null}

      <label htmlFor="pa-whatsapp">WhatsApp</label>
      <input
        id="pa-whatsapp"
        name="whatsapp"
        autoComplete="tel"
        inputMode="tel"
        required
        value={whatsapp}
        onChange={(e) => {
          setWhatsapp(e.target.value);
          clearFieldError("whatsapp");
        }}
        aria-invalid={Boolean(fieldErrors.whatsapp)}
        aria-describedby={`pa-whatsapp-help${fieldErrors.whatsapp ? " pa-whatsapp-error" : ""}`}
      />
      <p id="pa-whatsapp-help" className="pa-field-help">Informe DDD + número. Ex.: (11) 99999-0000.</p>
      {fieldErrors.whatsapp ? <p id="pa-whatsapp-error" role="alert">{fieldErrors.whatsapp}</p> : null}

      <label htmlFor="pa-email">E-mail (opcional)</label>
      <input
        id="pa-email"
        name="email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          clearFieldError("email");
        }}
        aria-invalid={Boolean(fieldErrors.email)}
        aria-describedby={fieldErrors.email ? "pa-email-error" : undefined}
      />
      {fieldErrors.email ? <p id="pa-email-error" role="alert">{fieldErrors.email}</p> : null}

      {error ? (
        <p role="alert">{error}</p>
      ) : null}

      <p>
        Ao criar o acesso você concorda com o uso dos dados de CNPJ e WhatsApp para liberação da
        loja.
      </p>

      <button type="submit" disabled={submitting}>
        {submitting ? "Enviando…" : "Criar acesso à loja"}
      </button>
    </form>
  );
}
