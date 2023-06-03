import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import client from "../../../../client/client";
import {
  AppProvider,
  LegacyCard,
  ResourceItem,
  ResourceList,
  Thumbnail,
} from "@shopify/polaris";
import ProviderInfo from "@/app/components/ProviderInfo";
import { formatServiceData } from "@/utils/services";
import { getProviderLogoUrl } from "@/utils/providers";
import { stagger, useAnimate } from "framer-motion";
import ProviderListItem from "./providerListItem";

export default function ProviderList({
  selectedMunicipality,
}: {
  selectedMunicipality: string | null;
}) {
  const [providers, setProviders] = useState<any>(null);

  useEffect(() => {
    const getProviders = async () => {
      const { providers } = await client("query")({
        providers: [
          { filters: { municipalities: { id: { eq: selectedMunicipality } } } },
          {
            data: {
              id: true,
              attributes: {
                services: [
                  {},
                  {
                    data: {
                      id: true,
                      attributes: {
                        Title: true,
                      },
                    },
                  },
                ],
                Title: true,
                logo: { data: { attributes: { url: true } } },
              },
            },
          },
        ],
      });

      return providers?.data ?? null;
    };

    getProviders().then((data) => {
      setProviders(data);
    });
  }, [selectedMunicipality]);

  if (!providers) {
    return <div>Loading...</div>;
  }
  const items = providers.map((provider: any) => {
    const { id, attributes } = provider;
    const {
      Title,
      services,
      logo: {
        data: {
          attributes: { url: logoPath },
        },
      },
    } = attributes;
    const serviceData = formatServiceData(services.data);
    const logoUrl = getProviderLogoUrl(attributes);
    return {
      id,
      url: "#",
      name: Title,
      logoUrl,
      serviceData,
    };
  });

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
          <LegacyCard>
            <ResourceList
              resourceName={{ singular: "customer", plural: "customers" }}
              items={items}
              renderItem={(item: any) => {
                const { id, url, name, logoUrl, serviceData } = item;
                const media = <Thumbnail source={logoUrl} alt={name} />;

                return (
                  <ResourceItem
                    id={id}
                    url={url}
                    media={media}
                    accessibilityLabel={`View details for ${name}`}
                  >
                    <motion.div
                      variants={{
                        hidden: { opacity: 0 },
                        show: { opacity: 1 },
                      }}
                    >
                      <ProviderListItem name={name} serviceData={serviceData} />
                    </motion.div>
                  </ResourceItem>
                );
              }}
            />
          </LegacyCard>
        </motion.div>
      </div>
    </AppProvider>
  );
}
