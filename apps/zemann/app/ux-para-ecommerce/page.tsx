import { pageMetadata } from "@/lib/seo";
import { SERVICES } from "@/lib/services";
import { ServicePage } from "../_components/service-page";

const service = SERVICES["ux"];
export const metadata = pageMetadata(service);

export default function UxPage() {
  return <ServicePage service={service} />;
}
