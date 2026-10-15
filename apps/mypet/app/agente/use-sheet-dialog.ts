import { useEffect, type RefObject } from "react";

// Painel de baixo para cima no celular aberto como diálogo: leva o foco ao
// título, trava a rolagem da página e fecha com Esc. Quem chama cuida do
// role="dialog", do inert no resto da página e de devolver o foco ao fechar.
export function useSheetDialog({
  active,
  onClose,
  focusRef,
}: {
  active: boolean;
  onClose: () => void;
  focusRef: RefObject<HTMLElement | null>;
}): void {
  useEffect(() => {
    if (!active) return;
    focusRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKey);
    };
  }, [active, onClose, focusRef]);
}
