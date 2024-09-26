import { Index } from "@upstash/vector";
import { qStashFanOut } from "../src/edge-util.js";
import { getAllProviders } from "../src/getAllProviders.js";
import { getMetadata } from "../src/getMetadata.js";
import { redis } from "../src/redis.js";

//when this is newer last indexation, we will update it always
const codeLastUpdated = 1727346619275;
export const GET = async (request: Request) => {
  const auth = request.headers.get("Authorization")?.slice("Bearer ".length);
  if (
    new URL(request.url).hostname !== "localhost" &&
    (!process.env.CRON_SECRET || auth !== process.env.CRON_SECRET)
  ) {
    return new Response("No CRON_SECRET", { status: 403 });
  }

  const [alreadyProviders, sourceProviders] = await Promise.all([
    getMetadata({}),
    getAllProviders(),
  ]);

  console.log("source-providers", sourceProviders?.length);
  if (!sourceProviders) {
    return new Response("No providers", { status: 500 });
  }

  const deletedProviders = Object.keys(alreadyProviders).filter(
    (providerSlug) => {
      const provider = alreadyProviders[providerSlug];
      const isHardcodedSource =
        provider.source === "apisguru" || provider.source === "primary";

      if (!isHardcodedSource) {
        // cant be deleted externally
        return false;
      }

      const stillSource = sourceProviders.find(
        (x) => x.providerSlug === providerSlug,
      );

      if (stillSource) {
        return false;
      }

      // not found in new source means it is deleted from there
      return true;
    },
  );

  if (deletedProviders.length > 0) {
    console.log("DELETED PROVIDERS", deletedProviders.length);
    const deleteResult = await Index.fromEnv().delete(deletedProviders);

    await redis.mdel(
      deletedProviders.map(
        (providerSlug) => `openapi-store.openapi.${providerSlug}`,
      ),
    );
  }

  const updatedProviders = sourceProviders
    .filter((x) => {
      const already = alreadyProviders?.[x.providerSlug];

      if (!already || !already.inserted || !already.updated) {
        return true;
      }

      const isAltered = !x.updated && already.sourceHash !== x.sourceHash;
      if (isAltered) {
        return true;
      }

      if (
        x.updated &&
        new Date(x.updated).valueOf() > new Date(already.updated).valueOf()
      ) {
        return true;
      }

      const codeUpdated =
        codeLastUpdated > new Date(already.inserted).valueOf();
      if (codeUpdated) {
        return true;
      }

      return false;
    })
    .slice(0, 250);

  console.log(
    "source providers",
    sourceProviders.length,
    "deleted providers",
    deletedProviders.length,
    "updated providers",
    updatedProviders.length,
  );

  console.log(
    `updated ones for now`,
    updatedProviders.map((x) => x.providerSlug),
  );

  if (!updatedProviders) {
    return new Response("No updated providers", { status: 200 });
  }

  const pages = new Array(Math.ceil(Object.keys(alreadyProviders).length / 500))
    .fill(null)
    .map((_, index) => index + 1);
  const resultOnline = await qStashFanOut(
    "https://openapisearch.com/checkOpenapiOnline",
    pages.map((page) => ({ page })),
    300,
    process.env.CRON_SECRET,
  );

  // much cleaner fan-out pattern
  const result = await qStashFanOut(
    "https://openapisearch.com/storeOpenapi",
    updatedProviders,
    0.01,
    process.env.CRON_SECRET,
  );

  // for local test
  // const result = {
  //   error: undefined,
  //   list: await Promise.all(
  //     updatedProviders.map(async (pro) => {
  //       await storeOpenapi(pro);
  //       return { error: undefined };
  //     }),
  //   ),
  // };

  if (result.error) {
    return new Response(result.error, { status: 500 });
  }

  if (result.list?.find((x) => !!x.error)) {
    console.log("FOUND ERRORS", {
      error: result.error,
      errors: result.list.filter((x) => !!x.error),
    });
  }

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
