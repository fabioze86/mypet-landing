import { quickAccessSteps } from "../../pre-access-content";
import { PaIcon } from "./icon";

export function QuickAccessSteps() {
  return (
    <section
      id="consultar-precos"
      className="pa-section pa-section--soft"
      aria-labelledby="consultar-precos-title"
    >
      <div className="pa-wrap">
        <h2 id="consultar-precos-title" className="pa-h2">Quer apenas consultar nossos preços?</h2>
        <ol className="pa-steps" style={{ listStyle: "none", padding: 0 }}>
          {quickAccessSteps.map((s, i) => (
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
        <div className="pa-steps-cta">
          <a href="/cadastro" className="pa-btn pa-btn-primary">Liberar meu acesso aos preços</a>
        </div>
      </div>
    </section>
  );
}
