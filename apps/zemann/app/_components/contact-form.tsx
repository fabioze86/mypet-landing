"use client";

import { useActionState, useEffect, useRef } from "react";
import { submitContact } from "@/app/actions";
import { INITIAL_CONTACT_STATE, type ContactField, type ContactFormKind } from "@/lib/contact";

const INPUT = "mt-1 w-full rounded-lg border border-line px-3 py-2 text-ink focus:border-accent focus:outline-none";

function Label({ htmlFor, required, children }: { htmlFor: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
      {children}
      {required ? <span aria-hidden> *</span> : null}
    </label>
  );
}

function FieldError({ message, id }: { message?: string; id: string }) {
  if (!message) return null;
  return <p id={id} className="mt-1 text-sm text-danger">{message}</p>;
}

export function ContactForm({ form, submitLabel }: { form: ContactFormKind; submitLabel: string }) {
  const [state, formAction, pending] = useActionState(submitContact, INITIAL_CONTACT_STATE);

  useEffect(() => {
    if (state.status === "success" && state.attempt > 0) {
      window.gtag?.("event", "generate_lead", { form });
    }
  }, [state.status, state.attempt, form]);

  const formRef = useRef<HTMLFormElement>(null);
  const alertRef = useRef<HTMLParagraphElement>(null);

  // Após envio com erro: foco no primeiro campo inválido (ordem do DOM) ou, sem erros de campo, no resumo.
  useEffect(() => {
    if (state.status !== "error") return;
    const first = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    (first ?? alertRef.current)?.focus();
  }, [state.status, state.attempt]);

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
    <form ref={formRef} key={state.attempt} action={formAction} noValidate className="grid gap-4">
      <input type="hidden" name="form" value={form} />
      <div aria-hidden className="absolute -left-[9999px]">
        <label>
          Não preencha
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div>
        <Label htmlFor="nome" required>Nome</Label>
        <input id="nome" name="nome" required defaultValue={v("nome")} aria-invalid={Boolean(err("nome"))} aria-describedby={described("nome")} className={INPUT} />
        <FieldError id="nome-erro" message={err("nome")} />
      </div>

      <div>
        <Label htmlFor="email" required>E-mail</Label>
        <input id="email" name="email" type="email" required defaultValue={v("email")} aria-invalid={Boolean(err("email"))} aria-describedby={described("email")} className={INPUT} />
        <FieldError id="email-erro" message={err("email")} />
      </div>

      <div>
        <Label htmlFor="empresa" required>Empresa ou marca</Label>
        <input id="empresa" name="empresa" required defaultValue={v("empresa")} aria-invalid={Boolean(err("empresa"))} aria-describedby={described("empresa")} className={INPUT} />
        <FieldError id="empresa-erro" message={err("empresa")} />
      </div>

      <div>
        <Label htmlFor="perfil" required>Você é</Label>
        <select id="perfil" name="perfil" required defaultValue={v("perfil")} aria-invalid={Boolean(err("perfil"))} aria-describedby={described("perfil")} className={INPUT}>
          <option value="" disabled>Escolha uma opção</option>
          <option value="marca">Marca ou indústria</option>
          <option value="seller">Seller (revenda ou loja)</option>
        </select>
        <FieldError id="perfil-erro" message={err("perfil")} />
      </div>

      <div>
        <Label htmlFor="loja">Link da sua loja ou de um produto na Amazon (opcional)</Label>
        <input id="loja" name="loja" type="url" defaultValue={v("loja")} aria-invalid={Boolean(err("loja"))} aria-describedby={described("loja")} className={INPUT} />
        <FieldError id="loja-erro" message={err("loja")} />
      </div>

      <div>
        <Label htmlFor="desafio" required>Seu desafio</Label>
        <textarea id="desafio" name="desafio" required rows={5} defaultValue={v("desafio")} aria-invalid={Boolean(err("desafio"))} aria-describedby={described("desafio")} className={INPUT} />
        <FieldError id="desafio-erro" message={err("desafio")} />
      </div>

      {state.status === "error" ? (
        <p ref={alertRef} tabIndex={-1} role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">{state.message}</p>
      ) : null}

      <button type="submit" disabled={pending} className="rounded-lg bg-accent px-5 py-3 font-semibold text-on-accent hover:bg-accent-dark disabled:opacity-60">
        {pending ? "Enviando…" : submitLabel}
      </button>
      <p className="text-xs text-muted">* Campos obrigatórios. Respondemos em até 1 dia útil.</p>
    </form>
  );
}
