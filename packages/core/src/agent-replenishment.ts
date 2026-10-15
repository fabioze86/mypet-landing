// Reposição pela compra habitual, em código puro (sem IA): para cada produto
// comprado em pelo menos 2 pedidos, compara os dias desde a última compra com o
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

type ProductHistory = { dates: number[]; lastQty: number };

function sumByProduct(items: { productId: string; qty: number }[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const item of items) totals.set(item.productId, (totals.get(item.productId) ?? 0) + item.qty);
  return totals;
}

export function computeReplenishment(orders: ReplenishmentOrder[], now: Date, limit: number): ReplenishmentPlan {
  const valid = orders
    .filter((o) => o.status !== "cancelado" && o.items.length > 0)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  if (valid.length === 0) return { tipo: "sem_historico", itens: [] };

  const history = new Map<string, ProductHistory>();
  for (const order of valid) {
    const time = Date.parse(order.createdAt);
    for (const [productId, qty] of sumByProduct(order.items)) {
      const entry = history.get(productId) ?? { dates: [], lastQty: 0 };
      entry.dates.push(time);
      entry.lastQty = qty;
      history.set(productId, entry);
    }
  }

  const due: (ReplenishmentSuggestion & { ratio: number })[] = [];
  let hasRepeat = false;
  for (const [productId, { dates, lastQty }] of history) {
    if (dates.length < 2) continue;
    hasRepeat = true;
    const first = dates[0];
    const last = dates[dates.length - 1];
    const average = (last - first) / (dates.length - 1) / DAY_MS;
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

  const lastOrder = valid[valid.length - 1];
  const since = Math.floor((now.getTime() - Date.parse(lastOrder.createdAt)) / DAY_MS);
  return {
    tipo: "compra_recente",
    itens: [...sumByProduct(lastOrder.items)]
      .slice(0, limit)
      .map(([productId, qty]) => ({ productId, daysSinceLast: since, averageIntervalDays: null, lastQty: qty })),
  };
}
