"use client";

import { useState } from "react";

/** Copia `text` para a área de transferência e confirma no próprio botão. */
export function CopyButton({ text, label, className }: { text: string; label: string; className?: string }) {
  const [state, setState] = useState<"idle" | "ok" | "fail">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("ok");
    } catch {
      setState("fail");
    }
    setTimeout(() => setState("idle"), 2200);
  }

  return (
    <button type="button" className={className} onClick={copy} aria-live="polite">
      {state === "ok" ? "Copiado" : state === "fail" ? "Não deu, copie à mão" : label}
    </button>
  );
}
