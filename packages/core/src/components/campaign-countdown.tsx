"use client";

import { useEffect, useState } from "react";
import { useClientConfig } from "../theme";

function msToParts(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  return {
    hours: Math.floor(totalSeconds / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

export function CampaignCountdown({ endsAt }: { endsAt: string | null }) {
  const { palette } = useClientConfig();
  const endsAtMs = endsAt ? new Date(endsAt).getTime() : null;
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (!endsAtMs) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [endsAtMs]);

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
