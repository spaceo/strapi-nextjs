import { Provider } from "@/types/types";
import { formatServiceData } from "./services";


export const getProviderLogoUrl = (attributes: Provider["attributes"]) => {
  const imagesHost = process.env.NEXT_PUBLIC_IMAGES_HOST;
  const url = attributes.logo?.data?.attributes?.url;
  return url ? `${imagesHost}${url}` : null;
}

export const createProviderListItems = (providers: Provider[]) => {
  return providers.map((provider: any) => {
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

    return {
      id,
      url: "#",
      name: Title,
      logoUrl: getProviderLogoUrl(attributes),
      serviceData: formatServiceData(services.data)
    };
  });
}