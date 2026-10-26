import Link from "next/link";
import { SERVICE_LIST } from "@/lib/services";

export function ServicesGrid() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {SERVICE_LIST.map((service) => {
        const featured = service.key === "amazon";
        return (
          <Link
            key={service.key}
            href={service.path}
            data-cta={`home_servico_${service.key.replace(/-/g, "_")}`}
            className={`group flex flex-col rounded-lg border p-6 transition hover:shadow-md ${
              featured ? "border-accent bg-accent-soft lg:col-span-2" : "border-line hover:border-accent"
            }`}
          >
            {featured ? (
              <span className="text-xs font-bold uppercase tracking-wide text-accent-dark">Carro-chefe</span>
            ) : null}
            <h3 className={`font-bold text-ink group-hover:text-accent ${featured ? "mt-2 text-2xl" : "text-lg"}`}>
              {service.name}
            </h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-soft">{service.summary}</p>
            <span aria-hidden className="mt-4 inline-block font-semibold text-accent">→</span>
          </Link>
        );
      })}
    </div>
  );
}
