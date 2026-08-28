/**
 * Grafismo de apoio do brand guide: ossinhos em baixa opacidade como textura de
 * fundo. Decorativo, nunca sobre informação de produto. `position: absolute` +
 * `pointer-events: none` — quem usa precisa de um wrapper com `position` e
 * conteúdo acima em z maior.
 */
export function BonePattern({
  color = "#FFFFFF",
  opacity = 0.07,
}: {
  color?: string;
  opacity?: number;
}) {
  return (
    <svg
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        color,
        opacity,
      }}
    >
      <defs>
        <pattern
          id="madpet-bones"
          width="132"
          height="132"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(18)"
        >
          <g fill="currentColor">
            <g transform="translate(14 24)">
              <circle cx="9" cy="8" r="7" />
              <circle cx="9" cy="20" r="7" />
              <circle cx="52" cy="8" r="7" />
              <circle cx="52" cy="20" r="7" />
              <rect x="9" y="8" width="43" height="12" rx="6" />
            </g>
            <g transform="translate(72 92)">
              <circle cx="7" cy="6" r="5.5" />
              <circle cx="7" cy="16" r="5.5" />
              <circle cx="40" cy="6" r="5.5" />
              <circle cx="40" cy="16" r="5.5" />
              <rect x="7" y="6" width="33" height="10" rx="5" />
            </g>
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#madpet-bones)" />
    </svg>
  );
}
