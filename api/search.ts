import { Index } from "@upstash/vector";
import { notEmpty } from "../src/edge-util";
import { upCount } from "../src/upCount";

export const config = {
  runtime: "edge", //NB: Must be iad1	us-east-1	Washington, D.C., USA for it to be fast with the vector
  regions: ["iad1"],
};

export const OPTIONS = async (request: Request) => {
  // Set CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
  // Handle OPTIONS request (preflight)
  return new Response(null, { headers });
};
export const GET = async (request: Request, context: { waitUntil: any }) => {
  const q = new URL(request.url).searchParams.get("q");
  const source = new URL(request.url).searchParams.get("source");
  const exact = new URL(request.url).searchParams.get("exact") === "1";

  const categories = new URL(request.url).searchParams.get("categories");

  const vectorRestToken = process.env.UPSTASH_VECTOR_REST_TOKEN;
  const vectorRestUrl = process.env.UPSTASH_VECTOR_REST_URL;

  if (!vectorRestToken || !vectorRestUrl) {
    console.error("NO KEYS", { vectorRestToken, vectorRestUrl });
    return new Response("No keys", { status: 422 });
  }

  const index = Index.fromEnv();

  const start = Date.now();

  const filters = [
    // never show invalid openapis
    `isOpenapiInvalid = false`,
    categories ? `categories CONTAINS '${categories}'` : undefined,
    source ? `source = '${source}'` : undefined,
    exact ? `providerSlug GLOB '*${q}*'` : undefined,
  ].filter(notEmpty);

  const results = await index.query({
    topK: 100,
    data: q || "",
    includeData: true,
    includeMetadata: true,
    filter: filters.join(" AND "),
    includeVectors: false,
  });

  const end = Date.now();
  const duration = end - start;

  if (!results) {
    return new Response("no result", {
      status: 400,
    });
  }
  if (q) {
    context.waitUntil(upCount("search_queries", q));
  }

  return new Response(JSON.stringify({ duration, results }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
