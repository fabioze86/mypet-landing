export function HeroIllustration() {
  const nodes = [
    [60, 70], [60, 170], [60, 270], [200, 120], [200, 220], [340, 170],
  ];
  return (
    <svg viewBox="0 0 420 340" role="img" aria-label="Produtos conectados a um painel de indicadores" className="h-auto w-full text-accent">
      <rect x="290" y="40" width="120" height="260" rx="10" className="fill-surface stroke-line" strokeWidth="2" />
      {[80, 130, 180, 230].map((y, i) => (
        <rect key={y} x="306" y={y} width={[88, 60, 76, 44][i]} height="14" rx="4" className="fill-accent-soft" />
      ))}
      {[[60, 70, 200, 120], [60, 170, 200, 120], [60, 170, 200, 220], [60, 270, 200, 220], [200, 120, 340, 170], [200, 220, 340, 170]].map(([x1, y1, x2, y2]) => (
        <line key={`${x1}-${y1}-${x2}-${y2}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeOpacity="0.35" strokeWidth="2" />
      ))}
      {nodes.map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="16" fill="currentColor" />
      ))}
    </svg>
  );
}
