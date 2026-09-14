"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useClientConfig } from "../theme";

function msToParts(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  return {
    hours: Math.floor(totalSeconds / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

/**
 * Store externo compartilhado (mesmo padrão de `cart-provider.tsx`): dispara
 * `Date.now()` a cada 1s e notifica subscribers. Existe para não chamar
 * `setState` dentro do corpo de um `useEffect` (dispara o lint
 * `react-hooks/set-state-in-effect` e pode gerar cascading renders) — o
 * relógio vive fora do React e os componentes só leem o snapshot atual via
 * `useSyncExternalStore`.
 *
 * O intervalo só roda enquanto houver pelo menos um subscriber ativo — ele é
 * criado no primeiro `subscribe` e destruído quando o último se desinscreve.
 */
type Listener = () => void;
const listeners = new Set<Listener>();
let currentNow = Date.now();
let intervalId: ReturnType<typeof setInterval> | null = null;

function tick() {
  currentNow = Date.now();
  listeners.forEach((listener) => listener());
}

function subscribeToClock(listener: Listener) {
  listeners.add(listener);
  if (!intervalId) {
    // Sem isso, o primeiro subscriber depois de um período sem nenhum
    // countdown ativo herda o `currentNow` congelado desde a última vez que
    // o intervalo rodou, e só vê um valor atualizado no próximo tick (até
    // 1s depois). Atualiza o valor compartilhado já aqui, na assinatura —
    // `useSyncExternalStore` detecta sozinho a mudança de snapshot logo
    // após `subscribe` e re-renderiza se preciso, sem precisar notificar os
    // listeners manualmente — em vez de esperar o primeiro tick do novo
    // `setInterval`.
    currentNow = Date.now();
    intervalId = setInterval(tick, 1000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
}

function getClockSnapshot() {
  return currentNow;
}

// No servidor não existe um "agora" consistente entre o render inicial e a
// hidratação — `null` sinaliza "ainda não sabemos" (equivalente ao antigo
// `useState<number | null>(null)`), e o componente não renderiza nada até o
// client assumir o snapshot real.
function getServerSnapshot(): number | null {
  return null;
}

export function CampaignCountdown({ endsAt }: { endsAt: string | null }) {
  const { palette } = useClientConfig();
  const endsAtMs = endsAt ? new Date(endsAt).getTime() : null;

  // Só assina o relógio compartilhado quando há uma data para contar —
  // evita manter o intervalo global rodando por causa de cards sem
  // countdown.
  const subscribe = useCallback(
    (listener: Listener) => {
      if (!endsAtMs) return () => {};
      return subscribeToClock(listener);
    },
    [endsAtMs],
  );

  const now = useSyncExternalStore(subscribe, getClockSnapshot, getServerSnapshot);

  if (!endsAtMs || now === null || endsAtMs <= now) return null;

  const { hours, minutes, seconds } = msToParts(endsAtMs - now);
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div
      data-testid="campaign-countdown"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: palette.navy,
        color: palette.white,
        borderRadius: 100,
        padding: "6px 14px",
        fontSize: 13,
        fontWeight: 800,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      ⚡ Termina em {pad(hours)}:{pad(minutes)}:{pad(seconds)}
    </div>
  );
}
