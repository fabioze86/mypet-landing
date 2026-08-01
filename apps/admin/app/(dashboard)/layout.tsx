import Link from "next/link";
import { requireAdminSession } from "@/lib/auth";
import { logout } from "../login/actions";

const NAV = [
  { href: "/clientes", label: "Clientes" },
  { href: "/pedidos", label: "Pedidos" },
  { href: "/categorias", label: "Categorias" },
  { href: "/funcionalidades", label: "Funcionalidades" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdminSession();

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="w-60 shrink-0 border-r border-slate-200 bg-white p-4">
        <p className="mb-6 px-2 text-sm font-bold text-slate-800">Painel admin</p>
        <nav className="flex flex-col gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              {item.label}
            </Link>
          ))}
          <div className="mt-2 px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Marketing
          </div>
          <Link
            href="/marketing/banners"
            className="rounded-lg px-3 py-2 pl-6 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Banners
          </Link>
        </nav>

        <form action={logout} className="mt-8 border-t border-slate-200 pt-4">
          <p className="mb-2 px-2 text-xs text-slate-400">{session.name}</p>
          <button type="submit" className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-100">
            Sair
          </button>
        </form>
      </aside>

      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
