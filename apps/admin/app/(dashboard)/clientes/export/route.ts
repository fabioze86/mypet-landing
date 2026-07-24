import { requireAdminSession } from "@/lib/auth";
import { leadsToCsv, type LeadRow } from "@/lib/leads";

export async function GET(req: Request): Promise<Response> {
  const { supabase } = await requireAdminSession();
  const url = new URL(req.url);
  const channel = url.searchParams.get("channel");
  const status = url.searchParams.get("status");

  let query = supabase
    .from("leads")
    .select("id, nome, empresa, whatsapp, cnpj, channel, status, created_at")
    .order("created_at", { ascending: false });

  if (channel) query = query.eq("channel", channel);
  if (status) query = query.eq("status", status);

  const { data } = await query;
  const csv = leadsToCsv((data ?? []) as LeadRow[]);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="leads.csv"',
    },
  });
}
