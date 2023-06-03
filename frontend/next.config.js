/** @type {import('next').NextConfig} */
const nextConfig = {
  publicRuntimeConfig: {
    NEXT_PUBLIC_STRAPI_TOKEN_PUBLIC: process.env.NEXT_PUBLIC_STRAPI_TOKEN_PUBLIC,
    NEXT_PUBLIC_STRAPI_GRAPHQL_ENDPOINT: process.env.NEXT_PUBLIC_STRAPI_GRAPHQL_ENDPOINT,
    NEXT_PUBLIC_IMAGES_HOST: process.env.NEXT_PUBLIC_IMAGES_HOST,
  },
  typescript: {
    // TODO: Remove this when ts erros have been fixed!!
    ignoreBuildErrors: true,
  },
}

module.exports = nextConfig
