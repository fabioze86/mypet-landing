import { educationCards } from "../../pre-access-content";

export function EducationCards() {
  return (
    <section className="pa-section pa-section--soft" aria-labelledby="educacao-title">
      <div className="pa-wrap">
        <h2 id="educacao-title" className="pa-h2">Antes de entrar na loja</h2>
        <p className="pa-sec-lead">Quatro pontos rápidos para saber se a My Pet atende sua operação.</p>
        <ul className="pa-edu-row" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {educationCards.map((card) => (
            <li key={card.id} className="pa-edu-card pa-card">
              <span className="pa-edu-mark" aria-hidden />
              <a href={card.href} style={{ textDecoration: "none" }}>
                <h3>{card.title}</h3>
                <p>{card.body}</p>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
