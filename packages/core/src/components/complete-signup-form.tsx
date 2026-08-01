"use client";

import { useState } from "react";
import { useClientConfig } from "../theme";

export function CompleteSignupForm({
  action,
}: {
  action: (formData: FormData) => Promise<{ error: string | null }>;
}) {
  const { palette } = useClientConfig();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    const result = await action(new FormData(e.currentTarget));
    if (result.error) {
      setError(result.error);
      setSubmitting(false);
    }
    // Sucesso: a action redireciona via redirect() do Next, então não há
    // necessidade de tratar sucesso aqui.
  };

  return (
    <form onSubmit={handleSubmit}>
      <input className="form-input" name="nome" placeholder="Seu nome" required />
      <input className="form-input" name="empresa" placeholder="Nome do pet shop / empresa" required />
      <input className="form-input" name="whatsapp" placeholder="WhatsApp com DDD" required />
      <input className="form-input" name="cnpj" placeholder="CNPJ (opcional)" />
      {error && (
        <p style={{ color: palette.orange, fontSize: 13, marginBottom: 8, textAlign: "center" }}>{error}</p>
      )}
      <button type="submit" className="form-submit" disabled={submitting}>
        {submitting ? "Salvando..." : "Concluir cadastro →"}
      </button>
    </form>
  );
}
