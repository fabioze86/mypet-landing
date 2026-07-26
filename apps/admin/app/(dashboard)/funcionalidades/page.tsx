import { SITES, FEATURE_REGISTRY, type SiteId } from "@mypet/core/features";
import { requireAdminSession } from "@/lib/auth";

const SITE_ORDER = Object.keys(SITES) as SiteId[];

export default async function FuncionalidadesPage() {
  await requireAdminSession();

  return (
    <div>
      <h1 className="mb-2 text-xl font-bold text-slate-800">Funcionalidades</h1>
      <p className="mb-6 text-sm text-slate-500">
        O que está ativo em cada site hoje. Somente leitura — para mudar, edite{" "}
        <code className="rounded bg-slate-100 px-1.5 py-0.5">packages/core/src/features.ts</code>{" "}
        e faça o deploy.
      </p>

      <table className="w-full border-collapse overflow-hidden rounded-xl border border-slate-200 bg-white text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
            <th className="px-4 py-3">Funcionalidade</th>
            {SITE_ORDER.map((siteId) => (
              <th key={siteId} className="px-4 py-3">{SITES[siteId].name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {FEATURE_REGISTRY.map((feature) => (
            <tr key={feature.id} className="border-b border-slate-100">
              <td className="px-4 py-3">
                <p className="font-semibold text-slate-700">{feature.label}</p>
                <p className="text-xs text-slate-400">{feature.description}</p>
              </td>
              {SITE_ORDER.map((siteId) => {
                const value = SITES[siteId].features[feature.id];
                const option = feature.options.find((o) => o.value === value);
                return (
                  <td key={siteId} className="px-4 py-3 text-slate-600">
                    {option?.label ?? value}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
