import { OpenapiDocument, camelCase, notEmpty } from "edge-util";
import { Provider } from "./types.js";
import { fetchOpenapi } from "openapi-util";

const DELTA_MS = 24 * 3600 * 1000;

export const getMyGithubProviders = async () => {
  const res = await fetch(
    "https://github.actionschema.com/CodeFromAnywhere/repos",
  );

  if (!res.ok) {
    return null;
  }

  const repos = (await res.json()) as {
    name: string;
    owner: string;
    description: string;
    homepage: string | undefined;
    html_url: string;
    /** e.g. 2024-09-02T05:51:03Z */
    updated_at: string;
    topics: string[];
    archived: boolean;
    private: boolean;
    openapiUrl: string | undefined;
  }[];

  console.log(repos.length, "repos");

  const myProviders = (
    await Promise.all(
      repos
        .map(async (item) => {
          const openapiUrl = item.openapiUrl as string | undefined;

          // older than 24h, don't do anything
          if (new Date(item.updated_at).valueOf() < Date.now() - DELTA_MS) {
            return;
          }

          if (!openapiUrl) {
            return;
          }

          const openapi = (await fetchOpenapi(openapiUrl)) as OpenapiDocument;

          if (!openapi || !openapi.paths) {
            return;
          }

          const provider: Provider = {
            openapiVer: "3.1.0",
            // TODO: find a better way for this
            added: item.updated_at,
            updated: item.updated_at,
            source: "internal",
            openapiUrl,
            providerSlug: camelCase(item.name),
            categories: item.topics,
            openapi,
          };
          return provider;
        })
        .filter(notEmpty),
    )
  ).filter(notEmpty);

  console.log("providers", myProviders.length);
  if (myProviders.length === 0) {
    return null;
  }

  return myProviders;
};
