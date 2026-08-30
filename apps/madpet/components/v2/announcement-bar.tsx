import { madPetPalette as palette } from "@/client-theme";

/** Valor mínimo de pedido para frete grátis na revenda. Ajuste comercial. */
const FRETE_GRATIS_MINIMO = "R$ 600";

export function AnnouncementBar() {
  return (
    <div
      style={{
        background: palette.purpleDark,
        color: palette.white,
        textAlign: "center",
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        padding: "9px 16px",
      }}
    >
      Frete grátis para revenda a partir de {FRETE_GRATIS_MINIMO} em pedido
    </div>
  );
}
