"use client";

import { useEffect, useState } from "react";
import { useClientConfig } from "@mypet/core/theme";

const DISMISS_KEY = "mypet_pwa_install_dismissed_at";
const DISMISS_DAYS = 7;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches;
}

function isDismissedRecently(): boolean {
  let raw: string | null;
  try {
    raw = localStorage.getItem(DISMISS_KEY);
  } catch {
    return false;
  }
  if (!raw) return false;
  const dismissedAt = Number(raw);
  if (Number.isNaN(dismissedAt)) return false;
  const daysSince = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
  return daysSince < DISMISS_DAYS;
}

function markDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // localStorage indisponivel: banner pode reaparecer, sem problema.
  }
}

export default function InstallPrompt() {
  const clientConfig = useClientConfig();
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (isStandalone() || isDismissedRecently()) return;

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setDeferredEvent(event as BeforeInstallPromptEvent);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  if (!deferredEvent) return null;

  async function handleInstall() {
    if (!deferredEvent) return;
    await deferredEvent.prompt();
    await deferredEvent.userChoice;
    setDeferredEvent(null);
  }

  function handleDismiss() {
    markDismissed();
    setDeferredEvent(null);
  }

  return (
    <div
      role="dialog"
      aria-label="Instalar aplicativo"
      style={{ background: clientConfig.palette.navy }}
      className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-between gap-4 px-4 py-3 text-white shadow-lg"
    >
      <span className="text-sm">
        Adicione {clientConfig.name} à tela inicial para acessar mais rápido.
      </span>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={handleInstall}
          className="rounded bg-white px-3 py-1.5 text-sm font-medium text-slate-900"
        >
          Instalar
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Fechar"
          className="px-2 py-1.5 text-lg leading-none text-white/80"
        >
          ×
        </button>
      </div>
    </div>
  );
}
