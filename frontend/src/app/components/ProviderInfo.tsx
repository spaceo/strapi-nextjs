import { Badge, Text } from "@shopify/polaris";

type ProviderInfoProps = {
  id: string;
  name: string;
  serviceData: { id: number; name: string }[];
};

export default function ProviderInfo({ id, name, serviceData }: ProviderInfoProps) {
  return (
    <div id={id}>
      <div className="py-5">
        <Text breakWord variant="bodyMd" fontWeight="bold" as="h4">
          {name}
        </Text>
      </div>
      <div className="min-w-100">
        {serviceData.map((service: any) => (
          <span key={service.id} className="mr-2">
            <Badge>{service.name}</Badge>
          </span>
        ))}
      </div>
    </div>
  );
}
