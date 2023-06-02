"use client";
import { AppProvider, Link } from "@shopify/polaris";
import { ValueTypes } from "../../../zeus";
import ProviderCard from "./providerCard";
import ProviderGrid from "./providerGrid";

type ProvidersBodyProps = {
  providers: ValueTypes["ProviderEntity"][];
};

export default async function ProvidersBody(providers: ProvidersBodyProps) {
  return (
    <AppProvider
      i18n={{
        Polaris: {
          ResourceList: {
            sortingLabel: "Sort by",
            defaultItemSingular: "item",
            defaultItemPlural: "items",
            showing: "Showing {itemsCount} {resource}",
            Item: {
              viewItem: "View details for {itemName}",
            },
          },
          Common: {
            checkbox: "checkbox",
          },
        },
      }}
    >
      <div className="p-5">
        <ProviderGrid>
          {providers.providers &&
            providers.providers.map((provider) => {
              const { id, attributes } = provider;
              if (!attributes || !attributes?.Title) return null;

              return <ProviderCard key={String(id)} provider={provider} />;
            })}
        </ProviderGrid>
        <div className="mt-5">
          <Link url="/providers?municipality=1">Find flere levenrandører ⏵</Link>
        </div>
      </div>
    </AppProvider>
  );
}
