import { pageMetadata } from "@/lib/seo";
import { SERVICES } from "@/lib/services";
import { ServicePage } from "../_components/service-page";

const service = SERVICES["assessoria"];
export const metadata = pageMetadata(service);

export default function AssessoriaPage() {
  return <ServicePage service={service} />;
}
