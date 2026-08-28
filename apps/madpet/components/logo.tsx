import { madPetLogo, theme } from "@/client-theme";

/**
 * Wordmark MAD PET recriado em CSS a partir do logotipo oficial (.jpg):
 * "MAD" azul sobre "PET" amarelo, tipo pesado arredondado (Fredoka), cada letra
 * levemente rotacionada — cara de adesivo recortado.
 *
 * variant "lockup": chip grafite ao redor (uso padrão, como no arquivo oficial).
 * variant "plain": sem fundo, para aplicar sobre Roxo Profundo ou branco.
 *
 * Área de respiro e tamanho mínimo (120px) são responsabilidade de quem usa,
 * conforme o brand guide.
 */
const MAD = [
  { ch: "M", rot: -6 },
  { ch: "A", rot: 4 },
  { ch: "D", rot: -3 },
];
const PET = [
  { ch: "P", rot: 5 },
  { ch: "E", rot: -5 },
  { ch: "T", rot: 4 },
];

export function Logo({
  size = 34,
  variant = "lockup",
}: {
  size?: number;
  variant?: "lockup" | "plain";
}) {
  const lockup = variant === "lockup";

  const line: React.CSSProperties = {
    display: "flex",
    fontFamily: "var(--font-fredoka), sans-serif",
    fontWeight: 700,
    fontSize: size,
    lineHeight: 0.82,
    letterSpacing: "-0.01em",
  };

  const letter = (rot: number, color: string): React.CSSProperties => ({
    display: "inline-block",
    color,
    transform: `rotate(${rot}deg)`,
  });

  return (
    <span
      role="img"
      aria-label="MAD PET"
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: size * 0.04,
        padding: lockup ? `${size * 0.34}px ${size * 0.44}px` : 0,
        background: lockup ? madPetLogo.graphite : "transparent",
        borderRadius: lockup ? theme.radiusInput : 0,
        userSelect: "none",
      }}
    >
      <span style={line} aria-hidden="true">
        {MAD.map((l, i) => (
          <span key={i} style={letter(l.rot, madPetLogo.blue)}>
            {l.ch}
          </span>
        ))}
      </span>
      <span style={{ ...line, letterSpacing: "0.06em" }} aria-hidden="true">
        {PET.map((l, i) => (
          <span key={i} style={letter(l.rot, madPetLogo.yellow)}>
            {l.ch}
          </span>
        ))}
      </span>
    </span>
  );
}
