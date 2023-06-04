"use client";
import { motion } from "framer-motion";
import {
  AppProvider,
  LegacyCard,
} from "@shopify/polaris";
import { createProviderListItems } from "@/utils/providers";
import ProviderListItem from "./providerListItem";
import { Provider } from "@/types/types";

export default function ProviderListBody({
  providers,
}: {
  providers: Provider[];
}) {
  const items = createProviderListItems(providers);
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
      <div className="mt-5">
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
          {items.map((item: any) => {
            const { id, name, logoUrl, serviceData } = item;

            return (
              <motion.div
                key={id}
                variants={{
                  hidden: { opacity: 0 },
                  show: { opacity: 1 },
                }}
              >
                <a aria-describedby={id} aria-label={`View details about ${name}`} tabIndex={0} href="/">
                <div className={`mb-3 provider-card`}>
                  <LegacyCard>
                    <ProviderListItem
                      id={id}
                      logoUrl={logoUrl}
                      name={name}
                      serviceData={serviceData}
                    />
                  </LegacyCard>
                </div>
                </a>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </AppProvider>
  );
}
