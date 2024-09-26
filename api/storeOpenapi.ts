import {
  fetchWithTimeout,
  notEmpty,
  tryParseJson,
  tryParseYamlToJson,
} from "edge-util";
import { OpenapiDocument, summarizeOpenapi } from "openapi-util";
import { embeddingsClient } from "../src/embeddings.js";
import { redis } from "../src/redis.js";
import { Provider } from "../src/types.js";
import { convertSwaggerToOpenapi } from "../src/convertSwaggerToOpenapi.js";
import { Index } from "@upstash/vector";

// TODO: make openapi-util edge-friendly to get unlimited scaling
// https://vercel.com/docs/functions/runtimes#automatic-concurrency-scaling
// export const config = {runtime:"edge"}
export const calculateMetadata = async (
  provider: Provider,
  controller: ReadableStreamDefaultController<any>,
) => {
  try {
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 10000);

    /**
  # Calculated data

  Create `calculateProperties` on backend to augment metadata, stored upon updating a provider in separate .calculated key

  - Fetch OpenAPI and convert to 3.x
  - Mark as invalid if it can't be made 3.x
  - Generate openapi summary of OpenAPI + some metadata we already had
  - Every provider page has 10 related providers out of 50 using LLM.
  - Create improved short description based on openapi summary. Use ChatGPT GPT-4o-mini
  - conversation starters

  Store it all alongside in `metadata.` or `generated.`

  Use generated description for vector.
   */
    const openapiJson: OpenapiDocument | undefined = provider.openapi
      ? provider.openapi
      : await fetch(provider.openapiUrl, { signal: abortController.signal })
          .then(async (res) => {
            if (!res.ok) {
              return;
            }

            const text = await res.text();

            const json = tryParseJson(text);

            if (json && (json as any).paths) {
              return json;
            }

            const yamlJson = tryParseYamlToJson(text);

            if (yamlJson && (yamlJson as any).paths) {
              return yamlJson;
            }

            return;
          })
          .catch((e) => {
            return undefined;
          });

    clearTimeout(timeoutId);

    controller.enqueue(
      new TextEncoder().encode(
        "\n\ndata: " + JSON.stringify({ status: "fetched" }),
      ),
    );

    const isSwagger =
      (openapiJson as any)?.swagger ||
      !openapiJson?.openapi ||
      !openapiJson?.openapi.startsWith("3.");

    const convertedOpenapi = isSwagger
      ? await convertSwaggerToOpenapi(provider.openapiUrl)
      : openapiJson;

    controller.enqueue(
      new TextEncoder().encode(
        "\n\ndata: " + JSON.stringify({ status: "converted" }),
      ),
    );

    const isOpenapiInvalid = !convertedOpenapi;

    const stringSummary = !convertedOpenapi
      ? undefined
      : ((await summarizeOpenapi(
          convertedOpenapi,
          provider.openapiUrl,
          false,
        )) as string);

    const basePath = convertedOpenapi?.servers?.[0]?.url?.startsWith("https://")
      ? convertedOpenapi?.servers?.[0]?.url
      : provider.openapiUrl
        ? new URL(provider.openapiUrl).origin
        : undefined;

    //NB: Simplified. Must be improved for .com.br etc.
    const domain = basePath
      ? new URL(basePath).hostname
          .split(".")
          .reverse()
          .slice(0, 2)
          .reverse()
          .join(".")
      : undefined;

    const logoUrl = provider.info?.["x-logo"]?.url;

    const logoAbortController = new AbortController();
    const timeoutId2 = setTimeout(() => abortController.abort(), 10000);

    const isLogoValid = logoUrl
      ? await fetch(logoUrl, { signal: logoAbortController.signal })
          .then(
            (res) =>
              res.ok &&
              res.headers.get("content-type")?.startsWith("image/") &&
              !logoUrl.endsWith(".png.svg"),
          )
          .catch((e) => {})
      : undefined;

    clearTimeout(timeoutId2);

    if (isLogoValid === false) {
      console.log("LOGO FALSE", provider.providerSlug);
      provider.info!["x-logo"] = undefined;
    }

    const info = { ...provider.info };

    controller.enqueue(
      new TextEncoder().encode(
        "\n\ndata: " + JSON.stringify({ status: "logo" }),
      ),
    );

    return { basePath, domain, stringSummary, isOpenapiInvalid, info };
  } catch (e) {
    console.log("error calculating metadata for " + provider.providerSlug, e);
    return { isOpenapiInvalid: true, metadataError: String(e) };
  }
};

export const storeOpenapi = async (
  provider: Provider,
  controller: ReadableStreamDefaultController<any>,
) => {
  const { openapi, securitySchemes, ...rest } = provider;

  console.log("slug", provider.providerSlug);
  const extra = await calculateMetadata(provider, controller);
  console.log("exgra", JSON.stringify(extra).length);

  const metadata: Provider = {
    ...rest,
    ...extra,
    // NB: metadata must be there!
    added: rest.added || new Date(Date.now()).toISOString(),
    updated: rest.updated || new Date(Date.now()).toISOString(),
  };

  const metadataTooLarge = JSON.stringify(metadata).length > 48000;

  if (metadataTooLarge) {
    console.error("Vector metadata doesn't fit for", provider.providerSlug);
    return;
  }

  // // set metadata
  // const metadataSetPromise = redis.set(
  //   `openapi-store.metadata.${metadata.providerSlug}`,
  //   metadata,
  // );

  //set security
  // const securitySetPromise = securitySchemes
  //   ? redis.set(`openapi-store.security.${metadata.providerSlug}`, {
  //       securitySchemes,
  //     })
  //   : undefined;

  const proxyUrl = `https://openapisearch.com/api/${metadata.providerSlug}/openapi.json`;
  const hasExternalStorage = metadata.openapiUrl !== proxyUrl;
  const openapiTooBig = openapi
    ? JSON.stringify(openapi).length >= 1024 * 1024
    : undefined;

  if (openapi && !hasExternalStorage) {
    if (openapiTooBig) {
      console.error(`${metadata.providerSlug} too big openapi`);
    } else {
      await redis.set(
        `openapi-store.openapi.${metadata.providerSlug}`,
        openapi,
      );
    }
  }

  const index = Index.fromEnv();

  // Only put it there if it fits in metadata.

  const data = [
    provider.providerSlug,
    provider.info?.title,
    provider.info?.description?.slice(0, 120),
    provider.categories?.join(","),
  ]
    .filter(notEmpty)
    .join(" - ");

  await index.upsert({
    id: provider.providerSlug,
    data,
    metadata,
  });

  return proxyUrl;
};

/** Called by upstash, so it can be a long function! */
export const POST = async (request: Request) => {
  // 1) Must be authenticated to store the openapi
  const auth = request.headers.get("Authorization")?.slice("Bearer ".length);
  if (
    new URL(request.url).hostname !== "localhost" &&
    (!process.env.CRON_SECRET || auth !== process.env.CRON_SECRET)
  ) {
    return new Response("No CRON_SECRET", { status: 403 });
  }

  const provider = await request.json();

  return new Response(
    new ReadableStream({
      async start(controller) {
        let buffer = "";

        const openapiUrl = await storeOpenapi(provider, controller);

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
