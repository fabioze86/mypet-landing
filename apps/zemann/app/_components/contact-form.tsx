"use client";

import { useActionState, useEffect } from "react";
import { submitContact } from "@/app/actions";
import { INITIAL_CONTACT_STATE, type ContactField, type ContactFormKind } from "@/lib/contact";

const INPUT = "mt-1 w-full rounded-lg border border-line px-3 py-2 text-ink focus:border-accent focus:outline-none";

function FieldError({ message, id }: { message?: string; id: string }) {
  if (!message) return null;
  return <p id={id} className="mt-1 text-sm text-red-700">{message}</p>;
}

export function ContactForm({ form, submitLabel }: { form: ContactFormKind; submitLabel: string }) {
  const [state, formAction, pending] = useActionState(submitContact, INITIAL_CONTACT_STATE);

  useEffect(() => {
    if (state.status === "success" && state.attempt > 0) {
      window.gtag?.("event", "generate_lead", { form });
    }
  }, [state.status, state.attempt, form]);

  if (state.status === "success") {
    return (
      <div role="status" className="rounded-lg border border-accent bg-accent-soft p-6 text-accent-dark">
        {state.message}
      </div>
    );
  }

  const v = (field: ContactField) => state.values[field] ?? "";
  const err = (field: ContactField) => state.errors[field];
  const described = (field: ContactField) => (err(field) ? `${field}-erro` : undefined);

  return (
    // key: remonta a cada envio para os campos voltarem com os valores devolvidos pela action.
    <form key={state.attempt} action={formAction} noValidate className="grid gap-4">
      <input type="hidden" name="form" value={form} />
      <div aria-hidden className="absolute -left-[9999px]">
        <label>
          Não preencha
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <label className="block text-sm font-medium text-ink">
        Nome *
        <input name="nome" required defaultValue={v("nome")} aria-invalid={Boolean(err("nome"))} aria-describedby={described("nome")} className={INPUT} />
        <FieldError id="nome-erro" message={err("nome")} />
      </label>

      <label className="block text-sm font-medium text-ink">
        E-mail *
        <input name="email" type="email" required defaultValue={v("email")} aria-invalid={Boolean(err("email"))} aria-describedby={described("email")} className={INPUT} />
        <FieldError id="email-erro" message={err("email")} />
      </label>

      <label className="block text-sm font-medium text-ink">
        Empresa ou marca *
        <input name="empresa" required defaultValue={v("empresa")} aria-invalid={Boolean(err("empresa"))} aria-describedby={described("empresa")} className={INPUT} />
        <FieldError id="empresa-erro" message={err("empresa")} />
      </label>

      <label className="block text-sm font-medium text-ink">
        Você é *
        <select name="perfil" required defaultValue={v("perfil")} aria-invalid={Boolean(err("perfil"))} aria-describedby={described("perfil")} className={INPUT}>
          <option value="" disabled>Escolha uma opção</option>
          <option value="marca">Marca ou indústria</option>
          <option value="seller">Seller (revenda ou loja)</option>
        </select>
        <FieldError id="perfil-erro" message={err("perfil")} />
      </label>

      <label className="block text-sm font-medium text-ink">
        Link da sua loja ou de um produto na Amazon (opcional)
        <input name="loja" type="url" defaultValue={v("loja")} aria-invalid={Boolean(err("loja"))} aria-describedby={described("loja")} className={INPUT} />
        <FieldError id="loja-erro" message={err("loja")} />
      </label>

      <label className="block text-sm font-medium text-ink">
        <span>Seu desafio *</span>
        <textarea name="desafio" required rows={5} defaultValue={v("desafio")} aria-invalid={Boolean(err("desafio"))} aria-describedby={described("desafio")} className={INPUT} />
        <FieldError id="desafio-erro" message={err("desafio")} />
      </label>

      {state.status === "error" ? (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{state.message}</p>
      ) : null}

      <button type="submit" disabled={pending} className="rounded-lg bg-accent px-5 py-3 font-semibold text-white hover:bg-accent-dark disabled:opacity-60">
        {pending ? "Enviando…" : submitLabel}
      </button>
      <p className="text-xs text-muted">* Campos obrigatórios. Respondemos em até 1 dia útil.</p>
    </form>
  );
}
