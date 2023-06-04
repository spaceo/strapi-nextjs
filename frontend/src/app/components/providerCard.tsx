"use client";
import { motion } from "framer-motion";
import { Card, Thumbnail } from "@shopify/polaris";
import ProviderInfo from "./ProviderInfo";
import { formatServiceData } from "@/utils/services";
import { getProviderLogoUrl } from "@/utils/providers";
import { Provider, Service } from "@/types/types";

type ProviderCardProps = {
  provider: Provider & {
    attributes: {
      services?: {
        data?: Service[];
      };
    };
  };
};

export default function ProviderCard({ provider, provider: {id} }: ProviderCardProps) {
  if (!provider.attributes?.services?.data) {
    return null;
  }
  const serviceData = formatServiceData(provider.attributes.services.data);
  const name = String(provider.attributes.Title);
  const logoUrl = getProviderLogoUrl(provider.attributes);
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0 },
        show: { opacity: 1 },
      }}
    >
      <a
        aria-describedby={id as string}
        aria-label={`View details about ${name}`}
        tabIndex={0}
        href="/"
      >
        <div className="provider-card h-full">
          <Card>
            {logoUrl && <Thumbnail source={logoUrl} alt={name} />}
            <ProviderInfo id={id as string} name={name} serviceData={serviceData} />
          </Card>
        </div>
      </a>
    </motion.div>
  );
}
