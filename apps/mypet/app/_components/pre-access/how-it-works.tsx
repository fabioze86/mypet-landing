import { steps } from "../../pre-access-content";
import { PaIcon } from "./icon";

export function HowItWorks() {
  return (
    <section
      id="como-funciona"
      className="pa-section pa-section--soft"
      aria-labelledby="como-funciona-title"
    >
      <div className="pa-wrap">
        <h2 id="como-funciona-title" className="pa-h2">Como funciona, em 4 passos</h2>
        <p className="pa-sec-lead">Do cadastro à entrega, sem cotação por WhatsApp.</p>
        <ol className="pa-steps" style={{ listStyle: "none", padding: 0 }}>
          {steps.map((s, i) => (
            <li key={s.id} className="pa-step">
              <span className="pa-step-num">{i + 1}</span>
              <span className="pa-step-icon">
                <PaIcon name={s.icon} size={22} />
              </span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
