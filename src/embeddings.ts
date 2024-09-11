import { Index } from "@upstash/vector";

/*

The biggest goal of this implementation of Vector search is for it to be super modular. By separating vector creation and vector db from another db, we can still use any db without limits.

REQUIREMENTS for a Vector micro-service OpenAPI

INDEX
- create index
- remove index

VECTOR
- upsert vector
- delete vector
- vectorize string
- vector search

*/

export interface EmbeddingCreateParams {
  /**
   * Input text to embed, encoded as a string or array of tokens. To embed multiple
   * inputs in a single request, pass an array of strings or array of token arrays.
   * The input must not exceed the max input tokens for the model (8192 tokens for
   * `text-embedding-ada-002`), cannot be an empty string, and any array must be 2048
   * dimensions or less.
   * [Example Python code](https://cookbook.openai.com/examples/how_to_count_tokens_with_tiktoken)
   * for counting tokens.
   */
  input: string | Array<string> | Array<number> | Array<Array<number>>;

  /**
   * ID of the model to use. You can use the
   * [List models](https://platform.openai.com/docs/api-reference/models/list) API to
   * see all of your available models, or see our
   * [Model overview](https://platform.openai.com/docs/models/overview) for
   * descriptions of them.
   */
  model:
    | (string & {})
    | "text-embedding-ada-002"
    | "text-embedding-3-small"
    | "text-embedding-3-large";

  /**
   * The number of dimensions the resulting output embeddings should have. Only
   * supported in `text-embedding-3` and later models.
   */
  dimensions?: number;

  /**
   * The format to return the embeddings in. Can be either `float` or
   * [`base64`](https://pypi.org/project/pybase64/).
   */
  encoding_format?: "float" | "base64";

  /**
   * A unique identifier representing your end-user, which can help OpenAI to monitor
   * and detect abuse.
   * [Learn more](https://platform.openai.com/docs/guides/safety-best-practices/end-user-ids).
   */
  user?: string;
}

export type OpenaiEmbeddingModelEnum =
  | "text-embedding-ada-002"
  | "text-embedding-3-small"
  | "text-embedding-3-large";

/**
 * a project is a collection of dbs.
 */
export type ProjectDetails = {
  adminUserId: string;
  description: string;
  databaseSlugs: string[];
};

export type AdminDetails = {
  currentProjectSlug: string;
};

export const deleteVector = async (context: {
  vectorRestUrl: string;
  vectorRestToken: string;
  ids: string[] | number[] | string | number;
  //namespace: string;
}) => {
  const { vectorRestToken, vectorRestUrl, ids } = context;

  const index = new Index({
    url: vectorRestUrl,
    token: vectorRestToken,
  });
  const result = await index.delete(
    ids,
    //{ namespace }
  );

  return result;
};

export const deleteIndex = async (context: {
  vectorRestUrl: string;
  vectorRestToken: string;
  namespace: string;
}) => {
  const { namespace } = context;
  const index = Index.fromEnv();
  const result = await index.deleteNamespace(namespace);
  return result;
};

/**
https://upstash.com/docs/vector

An array of objects may contain 1 column that I want vectorised. The array needs to initiate the db if not already. It can then insert a vector with {id, vector, metadata } where “id” can refer to a unique identifier of an item in the array.

We can now make search available in a crud.
 */

type VectorIndexResponse = {
  customerId: string;
  id: string;
  name: string;
  similarityFunction: string;
  dimensionCount: number;
  embeddingModel: string;
  /** the vectorRestUrl */
  endpoint: string;
  /** the vectorRestToken */
  token: string;
  readOnlyToken: string;
  type: string;
  region: string;
  maxVectorCount: number;
  maxDailyUpdates: number;
  maxDailyQueries: number;
  maxMonthlyBandwidth: number;
  maxWritesPerSecond: number;
  maxQueryPerSecond: number;
  maxReadsPerRequest: number;
  maxWritesPerRequest: number;
  creationTime: number;
};

/**
Even though it's not documented, reverse engineering the upstash console request worked fine
*/
export const createIndex = async (context: {
  upstashApiKey: string;
  upstashEmail: string;
  vectorIndexName: string;
  region: "us-east-1" | "eu-west-1" | "us-central1";
  dimension_count: number;
  similarity_function: "COSINE" | "EUCLIDIAN" | "DOT_PRODUCT";
}) => {
  const {
    upstashApiKey,
    upstashEmail,
    vectorIndexName,
    dimension_count,
    region,
    similarity_function,
  } = context;
  const url = `https://api.upstash.com/v2/vector/index`;
  const auth = `Basic ${btoa(`${upstashEmail}:${upstashApiKey}`)}`; // Encode credentials

  const result = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: vectorIndexName,
      region,
      type: "payg",
      dimension_count,
      similarity_function,
    }),
  })
    .then(async (response) => {
      const json = await response.json();
      return json as VectorIndexResponse;
    })
    .catch((error) => {
      console.error("Error:", error);
      return undefined;
    });

  return result;
};

/** NB: If we use this, we can later decouple it more easily with added openapi in between
 *
 *
 * Use submitVectorFromString and search mainly
 */
export const embeddingsClient = {
  createIndex,
  deleteVector,
};
