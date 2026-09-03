import { commercialConditions } from "../../pre-access-content";
import { PaIcon } from "./icon";

export function CommercialConditions() {
  return (
    <section id="condicoes" className="pa-section" aria-labelledby="condicoes-title">
      <div className="pa-wrap">
        <h2 id="condicoes-title" className="pa-h2">Condições comerciais</h2>
        <p className="pa-sec-lead">
          O que define o pedido antes de qualquer conversa. Os valores exatos aparecem dentro da loja.
        </p>
        <ul className="pa-cond-grid" style={{ listStyle: "none", padding: 0 }}>
          {commercialConditions.map((c) => (
            <li key={c.id} className="pa-card pa-cond-card">
              <span className="pa-cond-icon">
                <PaIcon name={c.icon} size={26} />
              </span>
              <h3>{c.title}</h3>
              <p className="pa-cond-value">{c.value}</p>
              <p className="pa-cond-detail">{c.detail}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
