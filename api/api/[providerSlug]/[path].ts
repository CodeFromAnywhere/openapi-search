import { fetchOpenapi, pruneOpenapi } from "openapi-util";
import { redis } from "../../../src/redis.js";
import { OpenapiDocument } from "openapi-util";
import * as yaml from "yaml";
import { Provider } from "../../../src/types.js";
import { convertSwaggerToOpenapi } from "../../../src/convertSwaggerToOpenapi.js";

/**

Features:

- retrieves either from our own store or from the original url if not stored
- yaml support
- operationIds support

*/

export const GET = async (request: Request) => {
  // retrieve from KV and respond with openapi
  const providerSlug = new URL(request.url).searchParams.get("providerSlug");

  const path = new URL(request.url).searchParams.get("path");

  if (!path || !providerSlug) {
    return new Response("Invalid params", { status: 400 });
  }

  const chunks = path.split(".");
  const extension = chunks.pop();
  const filename = chunks.join(".");

  const metadataPromise = redis.get<Provider>(
    `openapi-store.metadata.${providerSlug}`,
  );

  if (filename === "metadata") {
    // Respond with metadata
    const metadata = await metadataPromise;

    if (!metadata || !metadata.openapiUrl) {
      return new Response("Not found", { status: 404 });
    }

    if (extension === "yaml") {
      return new Response(yaml.stringify(metadata), {
        status: 200,
        headers: { "Content-Type": "text/yaml" },
      });
    }

    return new Response(JSON.stringify(metadata, undefined, 2), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (filename !== "openapi" && filename !== "swagger") {
    // other methods aren't allowed. Maybe later support "swagger" as filename as well
    return new Response("Method not allowed", { status: 400 });
  }

  if (filename === "swagger") {
    return new Response(
      "Swagger file format isn't supported. Contact me if needed.",
      { status: 400 },
    );
  }

  const openapiPromise = redis.get<OpenapiDocument>(
    `openapi-store.openapi.${providerSlug}`,
  );

  const [metadata, openapi] = await Promise.all([
    metadataPromise,
    openapiPromise,
  ]);

  if (!metadata || !metadata.openapiUrl) {
    return new Response("Not found", { status: 404 });
  }

  const realOpenapi = openapi || (await fetchOpenapi(metadata.openapiUrl));
  if (!realOpenapi) {
    return new Response("OpenAPI not found", { status: 404 });
  }

  const isSwagger =
    (realOpenapi as any).swagger ||
    !realOpenapi.openapi ||
    !realOpenapi.openapi.startsWith("3.");

  const convertedOpenapi = isSwagger
    ? await convertSwaggerToOpenapi(metadata.openapiUrl)
    : realOpenapi;

  if (!convertedOpenapi) {
    return new Response("Could not convert", { status: 404 });
  }

  const operationIds = new URL(request.url).searchParams
    .get("operationIds")
    ?.split(",")
    .map((x) => x.trim());

  console.log({ isSwagger, convertedOpenapi, operationIds });

  const finalOpenapi = operationIds?.length
    ? await pruneOpenapi(convertedOpenapi, operationIds, false)
    : convertedOpenapi;

  console.log({ finalOpenapi });

  if (!finalOpenapi) {
    return new Response("Could not get final openapi", { status: 500 });
  }

  if (extension === "yaml") {
    return new Response(yaml.stringify(finalOpenapi), {
      status: 200,
      headers: { "Content-Type": "text/yaml" },
    });
  }

  return new Response(JSON.stringify(finalOpenapi, undefined, 2), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
