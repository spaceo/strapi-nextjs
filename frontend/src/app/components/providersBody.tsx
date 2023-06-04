"use client";
import { motion } from "framer-motion";
import { AppProvider, Link } from "@shopify/polaris";
import ProviderGrid from "./providerGrid";
import { Provider } from "@/types/types";
import ProviderCards from "./providerCards";

type ProvidersBodyProps = {
  providers: Provider[];
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
      <div className="py-5">
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
          <div className="sm:hidden">
              {providers.providers && <ProviderCards providers={providers.providers} />}
          </div>
          <div className="hidden sm:block">
            <ProviderGrid>
              {providers.providers && <ProviderCards providers={providers.providers} />}
            </ProviderGrid>
          </div>
        </motion.div>
        <div className="mt-5">
          <Link url="/providers?municipality=2">
            Find flere levenrandører
          </Link>
        </div>
      </div>
    </AppProvider>
  );
}
