import { pageMetadata } from "@/lib/seo";
import { SERVICES } from "@/lib/services";
import { ServicePage } from "../_components/service-page";

const service = SERVICES["email-marketing"];
export const metadata = pageMetadata(service);

export default function EmailMarketingPage() {
  return <ServicePage service={service} />;
}
