"use client";
import { motion } from "framer-motion";
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
        <motion.div
          variants={{
            show: {
              transition: {
                staggerChildren: 0.1,
                delayChildren: 0.3,
              },
            },
          }}
          initial="hidden"
          animate="show"
        >
          <ProviderGrid>
            {providers.providers &&
              providers.providers.map((provider) => {
                const { id, attributes } = provider;
                if (!attributes || !attributes?.Title) return null;

                return <ProviderCard key={String(id)} provider={provider} />;
              })}
          </ProviderGrid>
        </motion.div>
        <div className="mt-5">
          <Link url="/providers?municipality=2">
            Find flere levenrandører ⏵
          </Link>
        </div>
      </div>
    </AppProvider>
  );
}
