import { Chain } from "../zeus";

const token = process.env.NEXT_PUBLIC_STRAPI_TOKEN_PUBLIC;
const graphqlEndpoint = process.env.NEXT_PUBLIC_STRAPI_GRAPHQL_ENDPOINT;

export default Chain(`${graphqlEndpoint}`, {
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
});
