import { OpenapiDocument } from "./edge-util.js";

// see: https://vercel.com/docs/functions/edge-middleware/limitations#limits-on-fetch-api
export const MAX_CONCURRENCY = 6;
export const MAX_FETCH_INVOCATIONS = 950;

type XLinks = { apiManagementUrl?: string };

export type Provider = {
  /** Overwritten, improved, title and description */
  info?: {
    title?: string;
    description?: string;
    ["x-links"]?: any;
    ["x-logo"]?: { backgroundColor?: string; url: string };
  };
  providerSlug: string;
  /**If true, url couldn't be found or parsed */
  isOpenapiInvalid?: boolean;
  openapi?: OpenapiDocument;
  /** iso time string */
  added?: string;
  /** iso timestring */
  updated?: string;
  /** Iso timestring of wehn it was inserted, not created or updated */
  inserted?: string;
  originalOpenapiUrl?: string;
  openapiUrl: string;
  categories?: string[];
  links?: XLinks;
  openapiVer: string;
  source: "register" | "primary" | "apisguru" | "secondary" | "internal";
  /** If required, the security scheme(s) with access token(s) can be provided here, to allow the OpenAPI to be tested */
  securitySchemes?: { key: string; access_token: string }[];

  /** calculated hash over the source (useful for seeing if it has changed) */
  sourceHash?: string;
};

export interface ApisGuruList {
  [providerSlug: string]: {
    /** Date string */
    added: string;
    /** Preferred version */
    preferred: string;

    versions: {
      [version: string]: {
        added: string;
        info: {
          contact?: {
            email?: string;
            name?: string;
            url?: string;
          };
          description: string;
          title: string;
          version: string;
          "x-apisguru-categories": string[];
          "x-logo": {
            backgroundColor?: string;
            url: string;
          };
          "x-origin": Array<{
            format: string;
            url: string;
            version: string;
          }>;
          "x-providerName": string;
          "x-serviceName"?: string;
        };
        updated: string;
        swaggerUrl: string;
        swaggerYamlUrl: string;
        openapiVer: string;
        link: string;
      };
    };
  };
}
