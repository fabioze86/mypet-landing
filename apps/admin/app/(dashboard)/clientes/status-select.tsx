"use client";

import type { LeadStatus } from "@/lib/leads";
import { LEAD_STATUSES } from "@/lib/leads";

export function StatusSelect({
  leadId,
  currentStatus,
  action,
}: {
  leadId: string;
  currentStatus: LeadStatus;
  action: (formData: FormData) => void;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={leadId} />
      <select
        name="status"
        defaultValue={currentStatus}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
      >
        {LEAD_STATUSES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
    </form>
  );
}
