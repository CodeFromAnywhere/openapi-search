import { OpenapiDocument } from "./edge-util";

/** NB: Not sure on the ratelimit on this, or logging */
export const convertSwaggerToOpenapi = async (swaggerUrl: string) => {
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), 10000);
  const result = await fetch(
    `https://converter.swagger.io/api/convert?url=${swaggerUrl}`,
    { signal: abortController.signal },
  )
    .then((res) => res.json() as Promise<OpenapiDocument>)
    .catch((e) => {
      return undefined;
    });

  clearTimeout(timeoutId);

  return result;
};
