import { Index } from "@upstash/vector";
import { Provider } from "./types.js";
export const getMetadata = async (context: {
  top?: "new" | "updated";
  category?: string;
  categories?: string[];
}) => {
  const { category, top, categories } = context;
  // `/metadata?filter=new|updated|popular&category&categories` each giving a top 100

  const index = Index.fromEnv();
  let cursor = "0";
  let res: Provider[] = [];
  let limit = 0;
  while (true) {
    limit++;

    if (limit > 200) {
      break;
    }

    const result = await index.range({
      cursor,
      limit: 100,
      includeMetadata: true,
    });

    const added = result.vectors
      .map((x) => x.metadata as Provider)
      .filter((item) => {
        if (category && item.category !== category) {
          return false;
        }
        if (
          categories &&
          categories.length &&
          !(item.categories || []).find((cat) => categories.includes(cat))
        ) {
          return false;
        }
        return true;
      });

    res = res.concat(added);

    if (result.nextCursor === "" || !result.nextCursor) {
      break;
    }
    cursor = result.nextCursor as string;
  }

  const topLlist =
    top === "new"
      ? res
          .sort((a, b) => {
            return (
              new Date(b.added || 0).valueOf() -
              new Date(a.added || 0).valueOf()
            );
          })
          .slice(0, 100)
      : top === "updated"
        ? res
            .sort((a, b) => {
              return (
                new Date(b.updated || 0).valueOf() -
                new Date(a.updated || 0).valueOf()
              );
            })
            .slice(0, 100)
        : res;

  const json = topLlist.reduce(
    (previous, current) => {
      if (current === null) {
        return previous;
      }
      return {
        ...previous,
        [current.providerSlug]: {
          ...current,
          originalOpenapiUrl: current.openapiUrl,
          openapiUrl: `https://openapisearch.com/${current.providerSlug}/openapi.json`,
        },
      };
    },
    {} as { [providerSlug: string]: Provider },
  );

  return json;
};
