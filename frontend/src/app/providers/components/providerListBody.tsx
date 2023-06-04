"use client";
import { motion } from "framer-motion";
import {
  AppProvider,
  LegacyCard,
  ResourceItem,
  ResourceList,
  Thumbnail,
} from "@shopify/polaris";
import { createProviderListItems } from "@/utils/providers";
import ProviderListItem from "./providerListItem";
import { Provider } from "@/types/types";

export default function ProviderListBody({
  providers,
}: {
  providers: Provider[];
}) {
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
      <div className="mt-10">
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
          <ResourceList
            resourceName={{ singular: "customer", plural: "customers" }}
            items={createProviderListItems(providers)}
            renderItem={(item: any) => {
              const { id, url, name, logoUrl, serviceData } = item;
              const media = <Thumbnail source={logoUrl} alt={name} />;

              return (
                <motion.div
                  variants={{
                    hidden: { opacity: 0 },
                    show: { opacity: 1 },
                  }}
                >
                  <div className="mb-5">
                    <LegacyCard>
                      <ResourceItem
                        id={id}
                        url={url}
                        media={media}
                        accessibilityLabel={`View details for ${name}`}
                      >
                        <ProviderListItem
                          name={name}
                          serviceData={serviceData}
                        />
                      </ResourceItem>
                    </LegacyCard>
                  </div>
                </motion.div>
              );
            }}
          />
        </motion.div>
      </div>
    </AppProvider>
  );
}
