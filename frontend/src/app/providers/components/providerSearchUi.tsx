"use client";

import { useSearchParams } from "next/navigation";
import ProviderFilter from "./providerFilter";
import ProviderList from "./providerList";
import { useCallback, useState } from "react";
import { setQueryParametersInUrl } from "@/utils/url";
import { Link } from "@shopify/polaris";

export default function ProviderSearchUi() {
  const urlParams = useSearchParams();
  const initialMunicipality = urlParams?.get("municipality") ?? "";
  const [selectedMunicipality, setSelectedMunicipality] =
    useState(initialMunicipality);

  const selectedMunicipalityHandler = useCallback((value: string) => {
    setSelectedMunicipality(value);
    setQueryParametersInUrl({ municipality: value });
  }, []);

  return (
    <div className="">
      <ProviderFilter
        initialMunicipality={selectedMunicipality}
        selectedMunicipalityHandler={selectedMunicipalityHandler}
      />
      {selectedMunicipality && (
        <ProviderList selectedMunicipality={selectedMunicipality} />
      )}
      <div className="mt-5">
        <Link url="/">Tilbage til forsiden</Link>
      </div>
    </div>
  );
}
