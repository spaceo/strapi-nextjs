import { Municipality } from "@/types/types";
import { Text } from "@shopify/polaris";
import MunicipalitySelect from "./municipalitySelect";

export default function ProviderFilter({
  initialMunicipality,
  selectedMunicipalityHandler,
}: {
  initialMunicipality: string;
  selectedMunicipalityHandler: (value: string) => void;
}) {
  return (
    <div className="md:grid md:grid-cols-3">
      <div className="md:col-span-2">
        <Text as="h2" variant="heading2xl">
          Find tjenester
        </Text>
      </div>
      <div className="md:col-span-1">
        <MunicipalitySelect
          municipality={initialMunicipality}
          onChangeHandler={selectedMunicipalityHandler}
        />
      </div>
    </div>
  );
}
