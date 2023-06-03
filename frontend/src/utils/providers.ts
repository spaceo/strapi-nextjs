import { ValueTypes } from "../../zeus";

export const getProviderLogoUrl = (attributes: Required<ValueTypes["ProviderEntity"]>["attributes"]) => {
  const imagesHost = process.env.NEXT_PUBLIC_IMAGES_HOST;
  const url = attributes.logo?.data?.attributes?.url;
  return url ? `${imagesHost}${url}` : null;
}
