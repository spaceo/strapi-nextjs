import { Badge, Text } from "@shopify/polaris";

type ProviderListItemProps = {
  name: string;
  serviceData: { id: number; name: string }[];
};

export default function ProviderListItem({ name, serviceData }: ProviderListItemProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="py-5">
        <Text breakWord variant="bodyMd" fontWeight="bold" as="h4">
          {name}
        </Text>
      </div>
      <div>
        {serviceData.map((service: any) => (
          <span key={service.id} className="mr-2">
            <Badge>{service.name}</Badge>
          </span>
        ))}
      </div>
    </div>
  );
}
