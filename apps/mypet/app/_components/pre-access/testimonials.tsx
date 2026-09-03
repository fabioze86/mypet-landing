import { testimonials } from "../../pre-access-content";
import { PaIcon } from "./icon";

export function Testimonials() {
  return (
    <section className="pa-section" aria-labelledby="depoimentos-title">
      <div className="pa-wrap">
        <h2 id="depoimentos-title" className="pa-h2">O que dizem os lojistas</h2>
        <div className="pa-quote-grid">
          {testimonials.map((t) => (
            <figure key={t.id} className="pa-quote">
              <div className="pa-quote-stars" aria-label="5 de 5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <PaIcon key={i} name="Star" size={15} weight="fill" />
                ))}
              </div>
              <blockquote>{t.quote}</blockquote>
              <figcaption>
                <strong>{t.name}</strong>
                <span>{t.city} · {t.store}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
