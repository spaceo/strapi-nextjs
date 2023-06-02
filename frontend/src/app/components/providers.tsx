import client from "../../../client/client";
import ProvidersBody from "./providersBody";

export default async function Providers() {
  const {
    // TODO: Fix this type
    // @ts-ignore
    providers: { data: providers },
  } = await client("query")({
    providers: [
      {},
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

  return (
    <>
      {/** @ts-ignore */}
      {providers && <ProvidersBody providers={providers} />}
    </>
  );
}
