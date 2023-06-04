import { Badge, Text } from "@shopify/polaris";

type ProviderListItemProps = {
  name: string;
  serviceData: { id: number; name: string }[];
};

export default function ProviderListItem({ name, serviceData }: ProviderListItemProps) {
  return (
    <div className="grid grid-cols-3 items-center">
      <div className="py-5 col-span-1">
        <Text variant="bodyMd" fontWeight="bold" as="h4">
          {name}
        </Text>
      </div>
      <div className="col-span-2">
        {serviceData.map((service: any) => (
          <span key={service.id} className="mr-2">
            <Badge>{service.name}</Badge>
          </span>
        ))}
      </div>
    </div>
  );
}
