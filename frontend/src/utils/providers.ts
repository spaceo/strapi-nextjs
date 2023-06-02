// export const makeServicesSolarisFriendly = (services: any) => providers.map((provider: any) => {
//     const { id, attributes } = provider;
//     const {
//       Title,
//       services,
//       logo: {
//         data: {
//           attributes: { url: logoPath },
//         },
//       },
//     } = attributes;

import { ValueTypes } from "../../zeus";


//     const providerServices = services.data.map(({ id, attributes }: any) => ({
//       id,
//       name: attributes.Title ?? "No title",
//     }));
//       const logoUrl = `http://localhost:1337${logoPath}`;
//     return {
//       id,
//       url: "#",
//       name: Title,
//       logoUrl,
//       providerServices,
//     };
//   });
// }

export const getProviderLogoUrl = (attributes: Required<ValueTypes["ProviderEntity"]>["attributes"]) => {
  const url = attributes.logo?.data?.attributes?.url;
  return url ? `https://profekto-strapi.herokuapp.com${url}` : null;
}