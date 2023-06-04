"use client";
import { AppProvider } from "@shopify/polaris";
import ProviderCard from "./providerCard";
import { Provider } from "@/types/types";

type ProviderCardsProps = {
  providers: Provider[];
};

export default function ProviderCards({providers}: ProviderCardsProps) {
  console.log(providers);
  return (
    <AppProvider i18n={{}}>
      {providers.map((provider: Provider) => {
        const { id, attributes } = provider;
        if (!attributes || !attributes?.Title) return null;

        return <ProviderCard key={String(id)} provider={provider} />;
      })}
    </AppProvider>
  );
}
