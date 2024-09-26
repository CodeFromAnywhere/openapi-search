import { tryParseJson, tryParseYamlToJson } from "edge-util";
import { OpenapiDocument } from "openapi-util";
import { convertSwaggerToOpenapi } from "../src/convertSwaggerToOpenapi.js";
import { Provider } from "./types.js";

export const fetchConvertedOpenapi = async (
  provider: Provider,
  controller?: ReadableStreamDefaultController<any>,
) => {
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

  controller?.enqueue(
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

  controller?.enqueue(
    new TextEncoder().encode(
      "\n\ndata: " + JSON.stringify({ status: "converted" }),
    ),
  );

  const isOpenapiInvalid = !convertedOpenapi;

  return { convertedOpenapi, isOpenapiInvalid };
};
