import { Index } from "@upstash/vector";
import { summarizeOpenapi } from "openapi-util";
import { fetchConvertedOpenapi } from "../src/fetchConvertedOpenapi.js";
import { getProviderDataString } from "../src/getProviderDataString.js";
import { redis } from "../src/redis.js";
import { Provider } from "../src/types.js";

// TODO: make openapi-util edge-friendly to get unlimited scaling
// https://vercel.com/docs/functions/runtimes#automatic-concurrency-scaling
// export const config = {runtime:"edge"}
export const calculateMetadata = async (
  provider: Provider,
  controller?: ReadableStreamDefaultController<any>,
) => {
  try {
    const { convertedOpenapi, isOpenapiInvalid } = await fetchConvertedOpenapi(
      provider,
      controller,
    );

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
    const timeoutId2 = setTimeout(() => logoAbortController.abort(), 10000);

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

    controller?.enqueue(
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
  controller?: ReadableStreamDefaultController<any>,
) => {
  const { openapi, securitySchemes, ...rest } = provider;
  const { stringSummary, ...extra } = await calculateMetadata(
    provider,
    controller,
  );

  const metadata: Provider = {
    ...rest,
    ...extra,
    // NB: metadata must be there!
    added: rest.added || new Date(Date.now()).toISOString(),
    updated: rest.updated || new Date(Date.now()).toISOString(),
    inserted: new Date(Date.now()).toISOString(),
  };

  const metadataTooLarge = JSON.stringify(metadata).length > 48000;

  const {
    added,
    updated,
    inserted,
    openapiUrl,
    openapiVer,
    providerSlug,
    source,
    categories,
    links,
    originalOpenapiUrl,
    sourceHash,
  } = metadata;

  const realMetadata = metadataTooLarge
    ? {
        added,
        updated,
        inserted,
        openapiUrl,
        openapiVer,
        providerSlug,
        source,
        categories,
        links,
        originalOpenapiUrl,
        sourceHash,
        isOpenapiInvalid: true,
        openapiInvalidError: `Metadata too large: ${JSON.stringify(metadata).length} characters > 48000`,
      }
    : metadata;

  // set metadata
  if (stringSummary) {
    const metadataSetPromise = redis.set(
      `openapi-store.summary.${metadata.providerSlug}`,
      stringSummary,
    );
  }

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

  await Index.fromEnv().upsert({
    id: provider.providerSlug,
    data: getProviderDataString(provider),
    metadata: realMetadata,
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
