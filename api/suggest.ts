import { getCountMatches, getTopCount } from "../src/getCount";

export const config = { runtime: "edge" };

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
export const GET = async (request: Request) => {
  const url = new URL(request.url);
  const q = url.searchParams.get("q");

  try {
    let suggestions: string[] | undefined;

    if (!q) {
      suggestions = await getTopCount("search_queries");
      if (!suggestions) {
        return new Response("Failed getting suggestions", { status: 500 });
      }
    } else {
      suggestions = await getCountMatches("search_queries", q);

      if (!suggestions) {
        return new Response("Failed getting suggestions", { status: 500 });
      }
      // If we don't have enough suggestions, pad with top queries
      if (suggestions.length < 9) {
        const topQueries =
          (await getTopCount("search_queries", 9 - suggestions.length)) || [];

        suggestions.push(
          ...topQueries.filter((query) => !suggestions!.includes(query)),
        );
      }
    }
    const parsedSuggestions = suggestions.map((q) =>
      decodeURIComponent(q).replaceAll("+", " "),
    );
    return new Response(JSON.stringify(parsedSuggestions), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error getting search suggestions:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
