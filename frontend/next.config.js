/** @type {import('next').NextConfig} */
const nextConfig = {
  publicRuntimeConfig: {
    NEXT_PUBLIC_STRAPI_ENDPOINT: process.env.NEXT_PUBLIC_STRAPI_ENDPOINT,
    NEXT_PUBLIC_STRAPI_TOKEN: process.env.NEXT_PUBLIC_STRAPI_TOKEN,
  },
  typescript: {
    // TODO: Remove this when ts erros have been fixed!!
    ignoreBuildErrors: true,
  },
}

module.exports = nextConfig
