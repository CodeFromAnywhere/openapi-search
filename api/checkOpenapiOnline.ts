import { Index } from "@upstash/vector";
import { mapMany } from "../src/edge-util.js";
import { fetchConvertedOpenapi } from "../src/fetchConvertedOpenapi.js";
import { getMetadata } from "../src/getMetadata.js";
import { getProviderDataString } from "../src/getProviderDataString.js";

export const config = {
  runtime: "edge", //NB: Must be iad1	us-east-1	Washington, D.C., USA for it to be fast with the vector
  regions: ["iad1"],
};

/** Limit at 500 per page, checking openapi urls with a max cap of 10s wait time + 10 for conversion */

export const POST = async (request: Request) => {
  // 1) Must be authenticated to store the openapi

  const json = await request.json();
  const page = json.page;
  if (!page) {
    return new Response("No page", { status: 400 });
  }

  const auth = request.headers.get("Authorization")?.slice("Bearer ".length);
  if (
    new URL(request.url).hostname !== "localhost" &&
    (!process.env.CRON_SECRET || auth !== process.env.CRON_SECRET)
  ) {
    return new Response("No CRON_SECRET", { status: 403 });
  }

  return new Response(
    new ReadableStream({
      async start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            "\n\ndata: " + JSON.stringify({ status: "started" }),
          ),
        );

        const metadata = await getMetadata({});

        controller.enqueue(
          new TextEncoder().encode(
            "\n\ndata: " + JSON.stringify({ status: "metadata" }),
          ),
        );

        const PER_PAGE = 500;

        const providerSlugs = Object.keys(metadata).slice(
          PER_PAGE * (page - 1),
          PER_PAGE * (page - 1) + PER_PAGE,
        );

        console.log(
          `Page ${page}: checking openapi for ${providerSlugs.length} providers`,
        );

        await mapMany(
          providerSlugs,
          async (providerSlug, index) => {
            const provider = metadata[providerSlug];

            if (!provider) {
              return;
            }

            const { isOpenapiInvalid } = await fetchConvertedOpenapi(
              provider,
              controller,
            );

            if (isOpenapiInvalid !== provider.isOpenapiInvalid) {
              // change occurred

              const index = Index.fromEnv();

              // Only put it there if it fits in metadata.

              const data = getProviderDataString(provider);
              console.log("PATCH NEEDED", providerSlug);

              await index.update({
                id: providerSlug,
                metadataUpdateMode: "PATCH",
                data,
                metadata: { isOpenapiInvalid },
              });
            }
          },
          6,
        );

        controller.close();
      },
    }),
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    },
  );
};
