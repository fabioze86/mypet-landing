import { clientConfig } from "@/client.config";
import { commercialFaq } from "../../pre-access-content";
import { FaqAssistant } from "./faq-assistant";

export function CommercialFaq() {
  return (
    <section id="faq" className="pa-section pa-section--soft pa-faq" aria-labelledby="faq-title">
      <div className="pa-wrap">
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
        <FaqAssistant channel={clientConfig.catalogChannel} />
      </div>
    </section>
  );
}
