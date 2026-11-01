export function ShippingForm({ orderId, action }: { orderId: string; action: (formData: FormData) => Promise<void> }) {
  return (
    <form action={action} className="mt-2 flex gap-2">
      <input type="hidden" name="orderId" value={orderId} />
      <input name="trackingCode" placeholder="Código de rastreio" className="rounded border border-slate-300 px-2 py-1 text-xs" required minLength={4} />
      <button type="submit" className="rounded bg-slate-800 px-3 py-1 text-xs font-semibold text-white">Marcar enviado</button>
    </form>
  );
}
