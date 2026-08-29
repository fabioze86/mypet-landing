import { institutionalPoints } from "../../pre-access-content";

export function InstitutionalTrust() {
  return (
    <section
      aria-labelledby="institucional-title"
      style={{ padding: "48px 24px", maxWidth: 760, margin: "0 auto" }}
    >
      <h2 id="institucional-title">Sobre a operação</h2>
      <ul>
        {institutionalPoints.map((point) => (
          <li key={point.id}>{point.label}</li>
        ))}
      </ul>
    </section>
  );
}
