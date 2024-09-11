import { upstashFanOut } from "edge-util";
import { getMetadata } from "../src/getMetadata.js";
import { getAllProviders } from "../src/getAllProviders.js";

//when this is newer last indexation, we will update it always
const codeLastUpdated = 1725431214649;
export const GET = async (request: Request) => {
  const auth = request.headers.get("Authorization")?.slice("Bearer ".length);
  if (
    new URL(request.url).hostname !== "localhost" &&
    (!process.env.CRON_SECRET || auth !== process.env.CRON_SECRET)
  ) {
    return new Response("No CRON_SECRET", { status: 403 });
  }

  const [alreadyProviders, providers] = await Promise.all([
    getMetadata({}),
    getAllProviders(),
  ]);

  console.log("providers", providers?.length);
  if (!providers) {
    return new Response("No providers", { status: 500 });
  }

  const updatedProviders = providers.filter((x) => {
    const already = alreadyProviders?.[x.providerSlug];
    if (!already) {
      return true;
    }

    if (!already.updated || !x.updated) {
      return true;
    }

    const isUpdated =
      new Date(already.updated).valueOf() > new Date(x.updated).valueOf();
    if (isUpdated) {
      return true;
    }
    //TODO: this isn't correct. we must have a date of insertion rather than just an updated date.
    const codeUpdated = codeLastUpdated > new Date(x.updated).valueOf();
    if (codeUpdated) {
      return true;
    }
    return false;
  });

  const dayCapProviders = updatedProviders.slice(0, 500);

  console.log(
    "providers",
    providers.length,
    "updated providers",
    updatedProviders.length,
    "limit",
    dayCapProviders.length,
  );

  if (!updatedProviders) {
    return new Response("No updated providers", { status: 200 });
  }

  // much cleaner fan-out pattern
  const result = await upstashFanOut(
    "https://openapisearch.com/storeOpenapi",
    dayCapProviders,
    0.01,
  );

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
