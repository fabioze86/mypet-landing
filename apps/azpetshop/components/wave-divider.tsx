export function WaveDivider({ color, flip = false }: { color: string; flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 1440 120"
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{
        display: "block",
        width: "100%",
        height: 80,
        transform: flip ? "scaleY(-1)" : undefined,
      }}
    >
      <path
        fill={color}
        d="M0,64 C240,120 480,0 720,32 C960,64 1200,120 1440,64 L1440,120 L0,120 Z"
      />
    </svg>
  );
}
