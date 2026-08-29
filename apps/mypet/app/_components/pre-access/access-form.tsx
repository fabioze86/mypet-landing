"use client";

import { useState } from "react";

const GENERIC_ERROR = "Não foi possível liberar seu acesso agora. Tente novamente em instantes.";

export function AccessForm() {
  const [cnpj, setCnpj] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
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
      setError(data?.error?.message ?? GENERIC_ERROR);
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
        onChange={(e) => setCnpj(e.target.value)}
      />

      <label htmlFor="pa-whatsapp">WhatsApp</label>
      <input
        id="pa-whatsapp"
        name="whatsapp"
        autoComplete="tel"
        inputMode="tel"
        required
        value={whatsapp}
        onChange={(e) => setWhatsapp(e.target.value)}
      />

      <label htmlFor="pa-email">E-mail (opcional)</label>
      <input
        id="pa-email"
        name="email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      {error ? (
        <p role="alert">{error}</p>
      ) : null}

      <p>
        Ao criar o acesso você concorda com o uso dos dados para liberação da loja, conforme a{" "}
        <a href="/politica-de-privacidade">política de privacidade</a>.
      </p>

      <button type="submit" disabled={submitting}>
        {submitting ? "Enviando…" : "Criar acesso à loja"}
      </button>
    </form>
  );
}
