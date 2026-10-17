"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

// Mantém o painel do agente ao vivo: assina o Realtime das tabelas do agente
// com a sessão do admin (a RLS só entrega eventos a quem está em admin_users)
// e recarrega os dados do servidor. Aba oculta não recarrega: marca pendente e
// recarrega quando o usuário volta.

const REFRESH_DEBOUNCE_MS = 1_000;
const POLL_MS = 30_000;
const TABLES = ["agent_conversations", "agent_messages", "agent_events"] as const;

export function LiveRefresh({
  supabaseUrl,
  supabaseAnonKey,
  conversationId,
  hasLive,
}: {
  supabaseUrl: string;
  supabaseAnonKey: string;
  conversationId?: string;
  hasLive: boolean;
}) {
  const router = useRouter();
  const [unavailable, setUnavailable] = useState(false);
  const pendingRef = useRef(false);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const refreshNow = () => {
      if (document.hidden) {
        pendingRef.current = true;
        return;
      }
      pendingRef.current = false;
      router.refresh();
    };
    const schedule = () => {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        if (active) refreshNow();
      }, REFRESH_DEBOUNCE_MS);
    };
    const onVisibility = () => {
      if (!document.hidden && pendingRef.current) refreshNow();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
    let channel = supabase.channel(conversationId ? `agente-conversa-${conversationId}` : "agente-lista");
    for (const table of TABLES) {
      const column = table === "agent_conversations" ? "id" : "conversation_id";
      const filter = conversationId ? { filter: `${column}=eq.${conversationId}` } : {};
      // Só INSERT e UPDATE: eventos DELETE não passam pela RLS (ver a migration).
      channel = channel
        .on("postgres_changes", { event: "INSERT", schema: "public", table, ...filter }, schedule)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table, ...filter }, schedule);
    }
    channel.subscribe((status) => {
      if (!active) return;
      if (status === "SUBSCRIBED") setUnavailable(false);
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.error("[agente] falha na assinatura do Realtime:", status);
        setUnavailable(true);
      }
    });

    return () => {
      active = false;
      if (timer !== null) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      void supabase.removeChannel(channel);
    };
  }, [router, supabaseUrl, supabaseAnonKey, conversationId]);

  // Selos expiram com o tempo (5 min / 60 s) e o Realtime pode falhar: nesses
  // casos recarrega também em intervalo fixo.
  useEffect(() => {
    if (!hasLive && !unavailable) return;
    const id = setInterval(() => {
      if (document.hidden) pendingRef.current = true;
      else router.refresh();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [hasLive, unavailable, router]);

  if (!unavailable) return null;
  return (
    <p className="mb-4 text-xs text-amber-700">
      Atualização ao vivo indisponível; a página recarrega a cada 30 segundos.
    </p>
  );
}
