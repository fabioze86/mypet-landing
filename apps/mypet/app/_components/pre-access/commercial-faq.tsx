import { commercialFaq } from "../../pre-access-content";

export function CommercialFaq() {
  return (
    <section
      id="faq"
      aria-labelledby="faq-title"
      style={{ padding: "48px 24px", maxWidth: 760, margin: "0 auto" }}
    >
      <h2 id="faq-title">Perguntas frequentes</h2>
      {commercialFaq.map((item) => (
        <details key={item.q} style={{ borderBottom: "1px solid #DDE2EC", padding: "12px 0" }}>
          <summary style={{ fontWeight: 700, cursor: "pointer" }}>{item.q}</summary>
          <p style={{ marginTop: 8 }}>{item.a}</p>
        </details>
      ))}
    </section>
  );
}
