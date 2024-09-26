import { hashCode, upstashFanOut } from "edge-util";
import { getMetadata } from "../src/getMetadata.js";
import { getAllProviders } from "../src/getAllProviders.js";
import { redis } from "../src/redis.js";
import { Index } from "@upstash/vector";

//when this is newer last indexation, we will update it always
const codeLastUpdated = 1727175997479;
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

      if (!already || !already.updated) {
        return true;
      }

      const isAltered = already.sourceHash !== x.sourceHash;
      if (isAltered) {
        return true;
      }

      if (x.updated && x.updated > already.updated) {
        return true;
      }

      const codeUpdated = codeLastUpdated > new Date(already.updated).valueOf();
      if (codeUpdated) {
        return true;
      }

      return false;
    })
    .slice(0, 10);

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

  // much cleaner fan-out pattern
  const result = await upstashFanOut(
    "https://openapisearch.com/storeOpenapi",
    updatedProviders,
    0.01,
  );

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
