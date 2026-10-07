import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // /loja e o catálogo digital (/catalogo, HTML estático em public/) mostram
  // preços de atacado: só para lojistas com acesso liberado.
  const isProtected = ["/loja", "/catalogo"].some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (isProtected) {
    try {
      const { verifyAccessToken, ACCESS_COOKIE } = await import("@mypet/core/access-session");
      if (!verifyAccessToken(request.cookies.get(ACCESS_COOKIE)?.value)) {
        return NextResponse.redirect(new URL("/", request.url));
      }
    } catch {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/loja", "/loja/:path*", "/catalogo", "/catalogo/:path*"],
};
