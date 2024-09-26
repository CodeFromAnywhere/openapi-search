import { Index } from "@upstash/vector";

export const GET = async () => {
  const index = Index.fromEnv();
  let cursor: string = "0";
  let ids: string[] = [];
  let limit = 0;
  while (true) {
    limit++;

    if (limit > 200) {
      return;
    }

    const result = await index.range({
      cursor,
      limit: 1000,
    });

    ids = ids.concat(result.vectors.map((x) => x.id));

    if (result.nextCursor === "" || !result.nextCursor) {
      break;
    }
    cursor = result.nextCursor as string;
  }

  // const keys = await redis.scan("openapi-store.metadata.");
  // if (!keys) {
  //   return new Response("scan went wrong");
  // }

  const list: string[] = ids.map(
    (id) => `https://openapisearch.com/api/${id}/openapi.json`,
  );

  return new Response(JSON.stringify(list), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
