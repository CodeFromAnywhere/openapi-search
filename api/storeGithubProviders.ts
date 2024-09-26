import { qStashFanOut } from "../src/edge-util.js";
import { getMyGithubProviders } from "../src/getMyGithubProviders.js";

export const GET = async (request: Request) => {
  const auth = request.headers.get("Authorization")?.slice("Bearer ".length);
  console.log("ENTERED FN");
  if (
    new URL(request.url).hostname !== "localhost" &&
    (!process.env.CRON_SECRET || auth !== process.env.CRON_SECRET)
  ) {
    return new Response("No CRON_SECRET", { status: 403 });
  }

  const providers = await getMyGithubProviders();

  console.log("providers", providers?.length);
  if (!providers) {
    return new Response("No providers", { status: 500 });
  }
  // much cleaner fan-out pattern
  const result = await qStashFanOut(
    "https://openapisearch.com/storeOpenapi",
    providers,
  );
  console.dir({ result }, { depth: 10 });

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
