// Reposição pela compra habitual, em código puro (sem IA): para cada produto
// comprado em pelo menos 2 dias distintos (UTC), compara os dias desde a última compra com o
// intervalo médio entre compras.

export type ReplenishmentOrder = { status: string; createdAt: string; items: { productId: string; qty: number }[] };

export type ReplenishmentSuggestion = {
  productId: string;
  daysSinceLast: number;
  averageIntervalDays: number | null;
  lastQty: number;
};

export type ReplenishmentPlan = {
  tipo: "reposicao" | "compra_recente" | "sem_historico";
  itens: ReplenishmentSuggestion[];
};

const DAY_MS = 86_400_000;
const DUE_RATIO = 0.8;

// Uma compra = um dia (UTC). Pedidos do mesmo produto no mesmo dia somam
// quantidade na mesma compra; `time` é o horário do último pedido do dia.
type Purchase = { day: number; time: number; qty: number };

function sumByProduct(items: { productId: string; qty: number }[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const item of items) totals.set(item.productId, (totals.get(item.productId) ?? 0) + item.qty);
  return totals;
}

const utcDay = (time: number) => Math.floor(time / DAY_MS);

export function computeReplenishment(orders: ReplenishmentOrder[], now: Date, limit: number): ReplenishmentPlan {
  const valid = orders
    .map((o) => ({ ...o, time: Date.parse(o.createdAt) }))
    // createdAt inválido (NaN) descarta o pedido
    .filter((o) => o.status !== "cancelado" && o.items.length > 0 && Number.isFinite(o.time))
    .sort((a, b) => a.time - b.time);
  if (valid.length === 0) return { tipo: "sem_historico", itens: [] };

  const history = new Map<string, Purchase[]>();
  for (const order of valid) {
    const day = utcDay(order.time);
    for (const [productId, qty] of sumByProduct(order.items)) {
      const purchases = history.get(productId) ?? [];
      const last = purchases[purchases.length - 1];
      if (last && last.day === day) {
        last.qty += qty;
        last.time = order.time;
      } else {
        purchases.push({ day, time: order.time, qty });
      }
      history.set(productId, purchases);
    }
  }

  const due: (ReplenishmentSuggestion & { ratio: number })[] = [];
  let hasRepeat = false;
  for (const [productId, purchases] of history) {
    if (purchases.length < 2) continue;
    hasRepeat = true;
    const first = purchases[0].time;
    const last = purchases[purchases.length - 1].time;
    const lastQty = purchases[purchases.length - 1].qty;
    const average = (last - first) / (purchases.length - 1) / DAY_MS;
    const since = (now.getTime() - last) / DAY_MS;
    if (average <= 0 || since < DUE_RATIO * average) continue;
    due.push({
      productId,
      daysSinceLast: Math.floor(since),
      averageIntervalDays: Math.round(average),
      lastQty,
      ratio: since / average,
    });
  }

  if (hasRepeat) {
    return {
      tipo: "reposicao",
      itens: due
        .sort((a, b) => b.ratio - a.ratio)
        .slice(0, limit)
        .map(({ ratio: _ratio, ...rest }) => rest),
    };
  }

  // Sem repetição: a última compra = todos os pedidos do último dia, somados.
  const lastOrder = valid[valid.length - 1];
  const lastDay = utcDay(lastOrder.time);
  const lastDayItems = valid.filter((o) => utcDay(o.time) === lastDay).flatMap((o) => o.items);
  const since = Math.floor((now.getTime() - lastOrder.time) / DAY_MS);
  return {
    tipo: "compra_recente",
    itens: [...sumByProduct(lastDayItems)]
      .slice(0, limit)
      .map(([productId, qty]) => ({ productId, daysSinceLast: since, averageIntervalDays: null, lastQty: qty })),
  };
}
