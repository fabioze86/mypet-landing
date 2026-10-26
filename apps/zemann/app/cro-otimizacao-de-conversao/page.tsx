import { pageMetadata } from "@/lib/seo";
import { SERVICES } from "@/lib/services";
import { ServicePage } from "../_components/service-page";

const service = SERVICES["cro"];
export const metadata = pageMetadata(service);

export default function CroPage() {
  return <ServicePage service={service} />;
}
