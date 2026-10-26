import { pageMetadata } from "@/lib/seo";
import { SERVICES } from "@/lib/services";
import { ServicePage } from "../_components/service-page";

const service = SERVICES["social-media"];
export const metadata = pageMetadata(service);

export default function SocialMediaPage() {
  return <ServicePage service={service} />;
}
