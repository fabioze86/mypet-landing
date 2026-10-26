import { pageMetadata } from "@/lib/seo";
import { SERVICES } from "@/lib/services";
import { ServicePage } from "../_components/service-page";

const service = SERVICES["seo"];
export const metadata = pageMetadata(service);

export default function SeoPage() {
  return <ServicePage service={service} />;
}
