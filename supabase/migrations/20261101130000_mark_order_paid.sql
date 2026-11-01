-- Marca o pedido como pago e baixa o estoque na mesma transação.
-- Só transiciona a partir de aguardando_pagamento/cancelado/expirado; devolve true só para quem efetivamente mudou o pedido.
create function public.mark_order_paid(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.orders
     set status = 'pago', updated_at = now()
   where id = p_order_id
     and status in ('aguardando_pagamento', 'cancelado', 'expirado');
  if not found then
    return false;
  end if;
  update public.products p
     set stock_qty = greatest(coalesce(p.stock_qty, 0) - oi.qty, 0)
    from public.order_items oi
   where oi.order_id = p_order_id
     and oi.product_id = p.id;
  return true;
end;
$$;

revoke all on function public.mark_order_paid(uuid) from public, anon, authenticated;
