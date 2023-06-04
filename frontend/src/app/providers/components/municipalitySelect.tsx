import { Select, Text } from "@shopify/polaris";

export default function MunicipalitySelect({
  municipality,
  onChangeHandler,
}: {
  municipality: string;
  onChangeHandler: (value: string) => void;
}) {
  const options = [
    { label: "Alle", value: "0" },
    { label: "Bagsværd", value: "3" },
    { label: "Birkerød", value: "1" },
    { label: "Gentofte", value: "2" },
    { label: "Gladsaxe", value: "5" },
    { label: "Køge", value: "4" },
  ];

  return (
    <div>
      <Text as="h2" variant="headingSm">
        Kommune
      </Text>
      <Select
        label=""
        options={options}
        onChange={onChangeHandler}
        value={municipality}
        placeholder="Vælg kommune"
      />
    </div>
  );
}
