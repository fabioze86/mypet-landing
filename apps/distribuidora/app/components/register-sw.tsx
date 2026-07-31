"use client";

import { useEffect } from "react";

export default function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Falha silenciosa: o site continua funcionando normalmente como
      // pagina comum, com ou sem os recursos de PWA disponiveis.
    });
  }, []);

  return null;
}
