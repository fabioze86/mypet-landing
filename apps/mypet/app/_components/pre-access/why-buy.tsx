import { whyBuyPoints } from "../../pre-access-content";
import { PaIcon } from "./icon";

export function WhyBuy() {
  return (
    <section className="pa-section pa-inst" aria-labelledby="why-buy-title">
      <div className="pa-wrap">
        <h2 id="why-buy-title" className="pa-h2">Por que comprar na My Pet Brasil?</h2>
        <div className="pa-inst-grid">
          {whyBuyPoints.map((item) => (
            <div key={item.id} className="pa-inst-item">
              <span className="pa-inst-icon"><PaIcon name={item.icon} size={22} /></span>
              <strong>{item.heading}</strong>
              <p>{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
