import {
  Text,
} from "@shopify/polaris";

type ProviderInfoProps = {
  name: string;
  serviceData: { id: number; name: string }[];
};

export default function ProviderInfo({ name, serviceData }: ProviderInfoProps) {
  return (
    <>
      <div className="py-5">
        <Text breakWord variant="bodyMd" fontWeight="bold" as="h4">
          {name}
        </Text>
      </div>
      <div>
        <Text breakWord as="h4" variant="headingSm">
          Ydelser
        </Text>
        {serviceData.map((service: any) => (
          <Text key={service.id} as="p" variant="bodySm">
            {service.name}
          </Text>
        ))}
      </div>
    </>
  );
}
