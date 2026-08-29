import { commercialConditions } from "../../pre-access-content";

export function CommercialConditions() {
  return (
    <section
      id="condicoes"
      aria-labelledby="condicoes-title"
      style={{ padding: "48px 24px", maxWidth: 960, margin: "0 auto" }}
    >
      <h2 id="condicoes-title">Condições comerciais</h2>
      <ul
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          listStyle: "none",
          padding: 0,
        }}
      >
        {commercialConditions.map((c) => (
          <li key={c.id} style={{ border: "1px solid #DDE2EC", borderRadius: 16, padding: 20 }}>
            <h3>{c.title}</h3>
            <p style={{ fontSize: 22, fontWeight: 900 }}>{c.value}</p>
            <p>{c.detail}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
