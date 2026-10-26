import { pageMetadata } from "@/lib/seo";
import { SERVICES } from "@/lib/services";
import { ServicePage } from "../_components/service-page";

const service = SERVICES["trafego-pago"];
export const metadata = pageMetadata(service);

export default function TrafegoPagoPage() {
  return <ServicePage service={service} />;
}
