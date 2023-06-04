import { Badge, Icon, Text, Thumbnail } from "@shopify/polaris";

type ProviderListItemProps = {
  id: string;
  name: string;
  serviceData: { id: number; name: string }[];
  logoUrl: string;
};

export default function ProviderListItem({ id, name, serviceData, logoUrl }: ProviderListItemProps) {
  return (
    <div id={id} className="grid grid-cols-3 items-center p-2">
      <div>
        <Thumbnail source={logoUrl} alt={name} />
      </div>
      <div className="py-5">
        <Text breakWord variant="bodyMd" fontWeight="bold" as="h4">
          {name}
        </Text>
      </div>
      <div className="hidden sm:block">
        {serviceData.map((service: any) => (
          <span key={service.id} className="mr-2">
            <Badge>{service.name}</Badge>
          </span>
        ))}
      </div>
    </div>
  );
}
