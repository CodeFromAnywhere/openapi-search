import { OpenapiDocument } from "openapi-util";

/** NB: Not sure on the ratelimit on this, or logging */
export const convertSwaggerToOpenapi = async (swaggerUrl: string) => {
  return fetch(`https://converter.swagger.io/api/convert?url=${swaggerUrl}`)
    .then((res) => res.json() as Promise<OpenapiDocument>)
    .catch((e) => {
      return undefined;
    });
};
