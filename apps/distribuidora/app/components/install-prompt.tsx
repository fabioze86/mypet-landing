"use client";

import { useEffect, useState } from "react";
import { useClientConfig } from "@mypet/core/theme";
import { subscribeToPush } from "@mypet/core/push";

const DISMISS_KEY = "mypet_pwa_install_dismissed_at";
const DISMISS_DAYS = 7;
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone(): boolean {
  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    navigatorWithStandalone.standalone === true
  );
}

function isMobileLike(): boolean {
  return window.matchMedia("(max-width: 768px), (pointer: coarse)").matches;
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
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

function requestPushSubscription() {
  if (!VAPID_PUBLIC_KEY) return;
  void subscribeToPush("distribuidora", VAPID_PUBLIC_KEY);
}

export default function InstallPrompt() {
  const clientConfig = useClientConfig();
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const standalone = isStandalone();

    if (standalone && typeof Notification !== "undefined" && Notification.permission === "default") {
      requestPushSubscription();
    }

    if (standalone || isDismissedRecently()) return;
    if (isMobileLike()) {
      queueMicrotask(() => setIsVisible(true));
    }

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setDeferredEvent(event as BeforeInstallPromptEvent);
      setIsVisible(true);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  if (!isVisible && !deferredEvent) return null;

  async function handleInstall() {
    if (!deferredEvent) return;
    try {
      await deferredEvent.prompt();
      const { outcome } = await deferredEvent.userChoice;
      if (outcome === "dismissed") {
        markDismissed();
      } else {
        requestPushSubscription();
      }
    } catch {
      // Falha relacionada a PWA deve ser sempre silenciosa e nunca travar a UI.
    } finally {
      setDeferredEvent(null);
      setIsVisible(false);
    }
  }

  function handleDismiss() {
    markDismissed();
    setDeferredEvent(null);
    setIsVisible(false);
  }

  const hasNativeInstall = Boolean(deferredEvent);
  const message = hasNativeInstall
    ? `Adicione ${clientConfig.name} à tela inicial para acessar mais rápido.`
    : isIos()
      ? `No Safari, toque em Compartilhar e depois em "Adicionar à Tela de Início".`
      : `Adicione ${clientConfig.name} à tela inicial para acessar mais rápido.`;

  return (
    <div
      role="dialog"
      aria-label="Instalar aplicativo"
      style={{ background: clientConfig.palette.navy }}
      className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-between gap-3 px-4 py-3 text-white shadow-lg"
    >
      <span className="min-w-0 text-sm leading-snug">{message}</span>
      <div className="flex shrink-0 items-center gap-2">
        {hasNativeInstall && (
          <button
            type="button"
            onClick={handleInstall}
            className="rounded bg-white px-3 py-1.5 text-sm font-medium text-slate-900"
          >
            Instalar
          </button>
        )}
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
