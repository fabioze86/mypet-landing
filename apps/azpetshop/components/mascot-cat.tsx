export function MascotCat({
  color = "#FFFFFF",
  width = 160,
  style,
}: {
  color?: string;
  width?: number;
  style?: React.CSSProperties;
}) {
  return (
    <svg viewBox="0 0 200 200" width={width} aria-hidden="true" style={{ display: "block", ...style }}>
      <g fill="none" stroke={color} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round">
        <path d="M60 70 L45 30 L75 55 Z" />
        <path d="M140 70 L155 30 L125 55 Z" />
        <ellipse cx="100" cy="110" rx="55" ry="48" />
        <circle cx="80" cy="100" r="4" fill={color} stroke="none" />
        <circle cx="120" cy="100" r="4" fill={color} stroke="none" />
        <path d="M92 115 Q100 122 108 115" />
        <path d="M60 120 Q30 110 20 130" />
        <path d="M60 128 Q28 130 18 148" />
        <path d="M140 120 Q170 110 180 130" />
        <path d="M140 128 Q172 130 182 148" />
        <path d="M150 140 Q175 150 170 175" />
      </g>
    </svg>
  );
}
