import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "./supabase-server";

export function createAuthCallbackHandler() {
  return async function GET(request: NextRequest): Promise<Response> {
    const code = request.nextUrl.searchParams.get("code");
    const next = request.nextUrl.searchParams.get("next") ?? "/cotacao";
    const origin = request.nextUrl.origin;

    if (!code) {
      return NextResponse.redirect(`${origin}/entrar?erro=link-invalido`);
    }

    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data.user) {
      return NextResponse.redirect(`${origin}/entrar?erro=link-invalido`);
    }

    const { data: buyer } = await supabase
      .from("buyers")
      .select("id")
      .eq("id", data.user.id)
      .maybeSingle();

    if (!buyer) {
      return NextResponse.redirect(`${origin}/completar-cadastro?next=${encodeURIComponent(next)}`);
    }

    return NextResponse.redirect(`${origin}${next}`);
  };
}
