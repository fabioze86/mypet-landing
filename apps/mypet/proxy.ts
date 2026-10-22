import { NextResponse, type NextRequest } from "next/server";
import { cadastroHref } from "./app/_components/hub/doors";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // /loja e o catálogo digital (/catalogo, HTML estático em public/) mostram
  // preços: só para lojistas com acesso liberado. O visitante do catálogo vai
  // ao cadastro e volta para ele; a /loja segue escondida e manda para a home.
  const isCatalogo = pathname === "/catalogo" || pathname.startsWith("/catalogo/");
  const isProtected = isCatalogo || pathname === "/loja" || pathname.startsWith("/loja/");
  if (isProtected) {
    const deny = () => NextResponse.redirect(new URL(isCatalogo ? cadastroHref("/catalogo") : "/", request.url));
    try {
      const { verifyAccessToken, ACCESS_COOKIE } = await import("@mypet/core/access-session");
      if (!verifyAccessToken(request.cookies.get(ACCESS_COOKIE)?.value)) return deny();
    } catch {
      return deny();
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/loja", "/loja/:path*", "/catalogo", "/catalogo/:path*"],
};
