/** @type {import('next').NextConfig} */
const nextConfig = {
  publicRuntimeConfig: {
    NEXT_PUBLIC_STRAPI_ENDPOINT: process.env.NEXT_PUBLIC_STRAPI_ENDPOINT,
    NEXT_PUBLIC_STRAPI_TOKEN: process.env.NEXT_PUBLIC_STRAPI_TOKEN,
  },
}

module.exports = nextConfig
