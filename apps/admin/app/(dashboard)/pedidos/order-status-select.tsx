"use client";

import type { OrderStatus } from "@/lib/orders";
import { ORDER_STATUSES } from "@/lib/orders";

export function OrderStatusSelect({
  orderId,
  currentStatus,
  action,
}: {
  orderId: string;
  currentStatus: OrderStatus;
  action: (formData: FormData) => void;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={orderId} />
      <select
        name="status"
        defaultValue={currentStatus}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
      >
        {ORDER_STATUSES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
    </form>
  );
}
