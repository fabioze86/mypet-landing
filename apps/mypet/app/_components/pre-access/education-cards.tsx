import { educationCards } from "../../pre-access-content";

export function EducationCards() {
  return (
    <section aria-labelledby="educacao-title" style={{ padding: "24px" }}>
      <h2 id="educacao-title">Antes de entrar na loja</h2>
      <ul
        style={{
          display: "flex",
          gap: 12,
          overflowX: "auto",
          listStyle: "none",
          padding: "8px 0",
          scrollSnapType: "x mandatory",
        }}
      >
        {educationCards.map((card) => (
          <li
            key={card.id}
            style={{
              flex: "0 0 240px",
              scrollSnapAlign: "start",
              border: "1px solid #DDE2EC",
              borderRadius: 16,
              padding: 16,
            }}
          >
            <a href={card.href}>
              <h3>{card.title}</h3>
              <p>{card.body}</p>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
