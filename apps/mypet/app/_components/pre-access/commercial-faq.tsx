import { commercialFaq } from "../../pre-access-content";

export function CommercialFaq() {
  return (
    <section id="faq" className="pa-section pa-faq" aria-labelledby="faq-title">
      <div className="pa-wrap" style={{ maxWidth: 780 }}>
        <h2 id="faq-title" className="pa-h2">Perguntas frequentes</h2>
        <p className="pa-sec-lead">As dúvidas que costumam chegar pelo WhatsApp, respondidas aqui.</p>
        <div className="pa-faq-list">
          {commercialFaq.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
