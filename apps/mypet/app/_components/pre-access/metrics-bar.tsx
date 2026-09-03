import { metrics } from "../../pre-access-content";

export function MetricsBar() {
  return (
    <section className="pa-metrics" aria-label="Números da operação">
      <div className="pa-wrap pa-metrics-row">
        {metrics.map((m) => (
          <div key={m.id} className="pa-metric">
            <span className="pa-metric-value">{m.value}</span>
            <span className="pa-metric-label">{m.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
