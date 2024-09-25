import { tryParseJson, tryParseYamlToJson } from "edge-util";
import { OpenapiDocument, summarizeOpenapi } from "openapi-util";
import { embeddingsClient } from "../src/embeddings.js";
import { redis } from "../src/redis.js";
import { Provider } from "../src/types.js";
import { convertSwaggerToOpenapi } from "../src/convertSwaggerToOpenapi.js";
import { Index } from "@upstash/vector";

//todo: make openapi-util edge-friendly to get unlimited scaling
// https://vercel.com/docs/functions/runtimes#automatic-concurrency-scaling
//export const config = {runtime:"edge"}
export const calculateMetadata = async (provider: Provider) => {
  try {
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
      : await fetch(provider.openapiUrl)
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

    const isSwagger =
      (openapiJson as any)?.swagger ||
      !openapiJson?.openapi ||
      !openapiJson?.openapi.startsWith("3.");

    const convertedOpenapi = isSwagger
      ? await convertSwaggerToOpenapi(provider.openapiUrl)
      : openapiJson;

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

    const isLogoValid = logoUrl
      ? await fetch(logoUrl).then(
          (res) =>
            res.ok &&
            res.headers.get("content-type")?.startsWith("image/") &&
            !logoUrl.endsWith(".png.svg"),
        )
      : undefined;

    if (isLogoValid === false) {
      console.log("LOGO FALSE", provider.providerSlug);
      provider.info!["x-logo"] = undefined;
    }

    const info = { ...provider.info };

    return { basePath, domain, stringSummary, isOpenapiInvalid, info };
  } catch (e) {
    return {};
  }
};

export const storeOpenapi = async (provider: Provider) => {
  const { openapi, securitySchemes, ...rest } = provider;

  const extra = await calculateMetadata(provider);

  const metadata = { ...rest, ...extra };

  // set metadata
  const metadataSetPromise = redis.set(
    `openapi-store.metadata.${metadata.providerSlug}`,
    metadata,
  );

  //set security
  const securitySetPromise = securitySchemes
    ? redis.set(`openapi-store.security.${metadata.providerSlug}`, {
        securitySchemes,
      })
    : undefined;

  const proxyUrl = `https://openapisearch.com/api/${metadata.providerSlug}/openapi.json`;
  const isNew = metadata.openapiUrl === proxyUrl;
  const openapiSize = openapi ? JSON.stringify(openapi).length : 0;

  const openapiNotTooBig = openapiSize < 1024 * 1024;
  if (openapi && isNew && !openapiNotTooBig) {
    console.error(`${metadata.providerSlug} too big openapi: ${openapiSize}`);
  }
  // to save storage, only store it if we can't just reuse the origin location.
  const openapiSetPromise =
    openapi && isNew && openapiNotTooBig
      ? redis.set(`openapi-store.openapi.${metadata.providerSlug}`, openapi)
      : undefined;

  const index = Index.fromEnv();

  // Only put it there if it fits in metadata.
  const vectorMetadata =
    !metadata || JSON.stringify(metadata).length > 48000 ? undefined : metadata;

  if (!vectorMetadata) {
    console.error("Vector metadata doesn't fit for", provider.providerSlug);
  }

  const upsertRresultPromise = await index.upsert({
    data: `${provider.providerSlug} - ${provider.info?.title || ""} - ${provider.info?.description || ""} - ${provider.categories?.join(",") || ""}`,
    id: provider.providerSlug,
    metadata: vectorMetadata,
  });

  const results = await Promise.all([
    upsertRresultPromise,
    metadataSetPromise,
    securitySetPromise,
    openapiSetPromise,
  ]);

  console.log(results);

  return proxyUrl;
};

export const POST = async (request: Request) => {
  const auth = request.headers.get("Authorization")?.slice("Bearer ".length);
  if (
    new URL(request.url).hostname !== "localhost" &&
    (!process.env.CRON_SECRET || auth !== process.env.CRON_SECRET)
  ) {
    return new Response("No CRON_SECRET", { status: 403 });
  }

  const provider = await request.json();
  const openapiUrl = await storeOpenapi(provider);

  return new Response(openapiUrl, {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
