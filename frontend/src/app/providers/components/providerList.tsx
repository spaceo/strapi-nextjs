import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import client from "../../../../client/client";
import ProviderListBody from "./providerListBody";

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

  return (
    <ProviderListBody providers={providers} />
  );
}
