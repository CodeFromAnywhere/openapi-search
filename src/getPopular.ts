import { Index } from "@upstash/vector";
import { getTopCount } from "./getCount.js";
import { notEmpty } from "./edge-util.js";
import { Provider } from "./types.js";

export const getPopular = async () => {
  const topProviderSlugs = await getTopCount("provider_expands", 100);
  if (!topProviderSlugs || topProviderSlugs.length === 0) {
    return;
  }

  const index = Index.fromEnv();
  const results = await index.fetch(topProviderSlugs, {
    includeMetadata: true,
  });

  const list = results.map((x) => x?.metadata).filter(notEmpty) as Provider[];

  const json = list.reduce(
    (previous, current) => {
      if (current === null) {
        return previous;
      }
      return {
        ...previous,
        [current.providerSlug]: {
          ...current,
          originalOpenapiUrl: current.openapiUrl,
          openapiUrl: `https://openapisearch.com/api/${current.providerSlug}/openapi.json`,
        },
      };
    },
    {} as { [providerSlug: string]: Provider },
  );
  return json;
};
