import { Select, Text } from "@shopify/polaris";

export default function MunicipalitySelect({
  municipality,
  onChangeHandler,
}: {
  municipality: string;
  onChangeHandler: (value: string) => void;
}) {
  const options = [
    { label: "Bagsværd", value: "7" },
    { label: "Birkerød", value: "5" },
    { label: "Gentofte", value: "6" },
    { label: "Gladsaxe", value: "9" },
    { label: "Køge", value: "8" },
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
