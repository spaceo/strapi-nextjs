"use client";
import { motion } from "framer-motion";
import { AppProvider, Link } from "@shopify/polaris";
import { ValueTypes } from "../../../zeus";
import ProviderCard from "./providerCard";
import ProviderGrid from "./providerGrid";
import { Provider } from "@/types/types";

type ProviderCardsProps = {
  providers: Provider[];
};

export default function ProviderCards(providers: ProviderCardsProps) {
  return (
    <AppProvider i18n={{}}>
      {providers.providers.map((provider: Provider) => {
        const { id, attributes } = provider;
        if (!attributes || !attributes?.Title) return null;

        return <ProviderCard key={String(id)} provider={provider} />;
      })}
    </AppProvider>
  );
}
