"use client";

import { useState } from "react";
import { createBrowserSupabaseClient } from "../supabase-browser";
import { useClientConfig } from "../theme";

export function LoginForm({ next }: { next?: string }) {
  const { palette } = useClientConfig();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const supabase = createBrowserSupabaseClient();
    const callbackUrl = new URL("/entrar/callback", window.location.origin);
    if (next) callbackUrl.searchParams.set("next", next);

    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl.toString() },
    });

    setSubmitting(false);
    if (authError) {
      setError("Não foi possível enviar o link agora. Tente novamente em instantes.");
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <div style={{ textAlign: "center", padding: 32 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>✉️</div>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: palette.navy, marginBottom: 8 }}>
          Verifique seu e-mail
        </h2>
        <p style={{ fontSize: 14, color: palette.gray600, lineHeight: 1.5 }}>
          Enviamos um link de acesso para {email}. Abra o e-mail no mesmo aparelho para continuar de onde parou.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        className="form-input"
        type="email"
        placeholder="Seu e-mail"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      {error && (
        <p style={{ color: palette.orange, fontSize: 13, marginBottom: 8, textAlign: "center" }}>{error}</p>
      )}
      <button type="submit" className="form-submit" disabled={submitting}>
        {submitting ? "Enviando..." : "Receber link de acesso →"}
      </button>
    </form>
  );
}
