"use client";

import type { OrderStatus } from "@/lib/orders";
import { allowedManualStatuses } from "@/lib/orders";

export function OrderStatusSelect({
  orderId,
  channel,
  currentStatus,
  action,
}: {
  orderId: string;
  channel: string;
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
        {allowedManualStatuses(channel, currentStatus).map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
    </form>
  );
}
