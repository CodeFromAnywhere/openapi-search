import { getMetadata } from "../src/getMetadata.js";
import { getPopular } from "../src/getPopular.js";

export const GET = async (request: Request) => {
  const top = new URL(request.url).searchParams.get("top") || undefined;
  const categories = new URL(request.url).searchParams.getAll("categories");
  const source = new URL(request.url).searchParams.get("source") || undefined;
  const popular = new URL(request.url).searchParams.get("popular") === "1";

  if (popular) {
    const popular = (await getPopular()) || {};

    return new Response(JSON.stringify(popular, undefined, 2), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const obj = await getMetadata({
    categories,
    source,
    top: top as "new" | "updated" | undefined,
  });

  if (!obj) {
    return new Response("scan went wrong", { status: 500 });
  }

  return new Response(JSON.stringify(obj, undefined, 2), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
