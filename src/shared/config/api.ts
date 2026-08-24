import { isDev, isServer } from "./vars";

export type StrapiConfigType = {
  strapiUrl: string;
  strapiNetworkUrl: string;
  strapiApiToken: string;
  previewSecret?: string;
};

export const baseUrl = !isDev
  ? `http://${process.env.PROJECT_SLUG}_backend:1337/api`
  : `${process.env.NEXT_PUBLIC_NETWORK_STRAPI_URL}/api`;

export const STRAPI_CONFIG: StrapiConfigType = {
  strapiUrl: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:1337",
  strapiNetworkUrl:
    (isServer ? baseUrl : process.env.NEXT_PUBLIC_SITE_URL) || "",
  strapiApiToken: process.env.NEXT_PUBLIC_STRAPI_API_TOKEN || "",
  previewSecret: process.env.PREVIEW_SECRET,
};
