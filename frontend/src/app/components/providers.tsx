import client from "../../../client/client";
import ProvidersBody from "./providersBody";

export default async function Providers() {
  const response = await client("query")({
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

  if (!response?.providers?.data) {
    return <div>Missing provider data...</div>;
  }

  const { providers: {data: providers} } = response;
  return (
    <>
      {/* @ts-expect-error Server Component */}
      {providers && <ProvidersBody providers={providers} />}
    </>
  );
}
