// Deviation from brief: this is a SYNC component that receives `categories` as a
// prop. `LandingPage` is the single async component — it calls `getCategories()`
// once and passes the array down. This keeps `render(await LandingPage())`
// working in jsdom (React cannot render an unresolved promise from an async
// child). Only category names are shown here — no price, no ProductCard.

type CategoryName = { id: string; name: string };

export function PopularCategories({ categories }: { categories: readonly CategoryName[] }) {
  return (
    <section
      id="categorias"
      aria-labelledby="categorias-title"
      style={{ padding: "48px 24px", maxWidth: 960, margin: "0 auto" }}
    >
      <h2 id="categorias-title">Categorias mais procuradas</h2>
      <ul style={{ display: "flex", flexWrap: "wrap", gap: 8, listStyle: "none", padding: 0 }}>
        {categories.map((category) => (
          <li
            key={category.id}
            style={{ border: "1px solid #DDE2EC", borderRadius: 100, padding: "6px 14px" }}
          >
            {category.name}
          </li>
        ))}
      </ul>
    </section>
  );
}
