import {
  OpenapiDocument,
  slugify,
  tryParseJson,
  tryParseYamlToJson,
} from "edge-util";
import { redis } from "../src/redis.js";
import { storeOpenapi } from "./storeOpenapi.js";

const getAvailableSlug = async (slug: string) => {
  let suffix = 0;
  let openapi: OpenapiDocument | null = null;

  while (true) {
    openapi = await redis.get<OpenapiDocument>(
      "openapi-store." + slug + (suffix === 0 ? "" : String(suffix)),
    );

    if (!openapi) {
      break;
    }
    suffix += 1;
  }

  return slug + (suffix === 0 ? "" : String(suffix));
};

/** Registers new OpenAPI */
export const POST = async (request: Request) => {
  // store
  const json = await request.json();

  if (!json.slug || json.slug.length > 100) {
    return new Response("invalid slug", { status: 404 });
  }

  if (!json.openapiUrl || !json.openapi) {
    return new Response("Not found", { status: 404 });
  }

  // store slug -> openapi or if slug was already taken, choose slug
  const chosenSlug = await getAvailableSlug(slugify(json.slug));

  const openapiJson: OpenapiDocument | undefined = json.openapiUrl
    ? await fetch(json.openapiUrl)
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
        })
    : json.openapi;

  if (!openapiJson || !openapiJson.paths) {
    return new Response("OpenAPI not found", { status: 404 });
  }

  if (JSON.stringify(openapiJson).length > 1000000) {
    return new Response("too big", { status: 422 });
  }

  const openapiUrl =
    json.openapiUrl ||
    `https://openapisearch.com/api/${chosenSlug}/openapi.json`;

  const proxyUrl = await storeOpenapi({
    openapiVer: openapiJson.openapi,
    openapiUrl,
    providerSlug: chosenSlug,
    openapi: json.openapi,
    categories: json.categories,
    links: json.links,
    category: "register",
    securitySchemes: json.securitySchemes,
  });

  return new Response(proxyUrl, { status: 201 });
};
