import { Index } from "@upstash/vector";
import { upCount } from "../../../src/upCount.js";

export const config = { runtime: "edge" };
export const GET = async (request: Request, context: any) => {
  const providerSlug = new URL(request.url).searchParams.get("providerSlug");
  if (!providerSlug) {
    return new Response("Not found", { status: 404 });
  }
  const html = await fetch(new URL(request.url).origin + "/openapi.html").then(
    (res) => res.text(),
  );

  const metadata = (
    await Index.fromEnv().fetch([providerSlug], { includeMetadata: true })
  )?.[0]?.metadata;

  // TODO: Add 10 out of 50 related providers here or so using LLM.

  const related: any[] = [];

  if (!metadata) {
    return new Response("Oh oh! No existomundo", { status: 404 });
  }

  const replaced = html.replace(
    "const data = {};",
    `const data = ${JSON.stringify({ metadata, related })};`,
  );

  context.waitUntil(upCount("provider_expands", providerSlug));

  return new Response(replaced, {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });
};
