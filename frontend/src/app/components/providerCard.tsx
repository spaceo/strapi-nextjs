"use client";
import { Card, Thumbnail } from "@shopify/polaris";
import ProviderInfo from "./ProviderInfo";
import { formatServiceData } from "@/utils/services";
import { getProviderLogoUrl } from "@/utils/providers";
import { ValueTypes } from "../../../zeus";

type ProviderCardProps = {
  provider: Required<ValueTypes["ProviderEntityResponse"]>["data"] & {
    attributes: {
      services: {
        data: Required<ValueTypes["ServiceEntityResponse"]>["data"];
      };
    };
  };
};

export default function ProviderCard({ provider }: ProviderCardProps) {
  if (!provider.attributes?.services?.data) {
    return null;
  }
  const serviceData = formatServiceData(provider.attributes.services.data);
  const name = String(provider.attributes.Title);
  const logoUrl = getProviderLogoUrl(provider.attributes);

  return (
    <Card>
      {logoUrl && <Thumbnail source={logoUrl} alt={name} />}
      <ProviderInfo name={name} serviceData={serviceData} />
    </Card>
  );
}
