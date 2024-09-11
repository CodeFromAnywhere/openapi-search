import { notEmpty, onlyUnique2 } from "edge-util";
import { Provider, ApisGuruList } from "./types.js";

/** should take under 10 sec */
export const getAllProviders = async () => {
  const providersPromise = fetch(
    "https://openapisearch.com/providers.json",
  ).then(
    (res) =>
      res.json() as Promise<{
        $schema: string;
        providers: { [key: string]: Provider };
      }>,
  );

  const apisGuruListPromise: Promise<ApisGuruList | number> = fetch(
    "https://api.apis.guru/v2/list.json",
    { headers: { "Content-Type": "application/json" } },
  ).then((res) => (res.ok ? res.json() : res.status));

  const [providersResult, apisGuruList] = await Promise.all([
    providersPromise,
    apisGuruListPromise,
  ]);

  if (!providersResult?.providers) {
    console.error("Couldn't get providers");
    return;
  }

  if (!apisGuruList || typeof apisGuruList === "number") {
    console.error("Couldn't get apis guru list", apisGuruList);
    return;
  }

  const primaryProviders = providersResult?.providers
    ? Object.keys(providersResult.providers)
        .map((providerSlug) => {
          const provider = providersResult.providers[providerSlug];

          if (!provider) {
            return;
          }

          const { info, openapiUrl, categories, openapiVer } = provider;
          const p: Provider = {
            links: info?.["x-links"],
            openapiVer: openapiVer,
            category: "primary",
            openapiUrl,
            providerSlug,
            info,
            categories,
          };
          return p;
        })
        .filter(notEmpty)
    : [];

  const apisGuruProviders = Object.keys(apisGuruList)
    .map((providerSlug) => {
      const item = apisGuruList[providerSlug];
      if (!item.preferred) {
        console.error(`${providerSlug} doesn't have preferred version!`);
        return;
      }

      const { added, updated, info, link, openapiVer } =
        item.versions[item.preferred];

      const p: Provider = {
        added,
        updated,
        openapiVer,
        category: "apisguru",
        // NB: get the original URL
        openapiUrl: info?.["x-origin"]?.[0]?.url || link,
        providerSlug,
        info,
        categories: info?.["x-apisguru-categories"],
      };

      return p;
    })
    .filter(notEmpty);

  const unique = primaryProviders.concat(apisGuruProviders).filter(
    // NB: priority is given to earlier ones, meaning if I list them, apisGuru with the same url will be overwritten!
    onlyUnique2<{ openapiUrl: string }>(
      (a, b) => a.openapiUrl === b.openapiUrl,
    ),
  );
  console.log(
    `primary:${primaryProviders.length}, guru: ${apisGuruProviders.length} = unique: ${unique.length}`,
  );

  return unique as Provider[];
};
//test:
//getAllProviders().then((res) => console.log("unique", res?.length));
