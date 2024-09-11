import { getMetadata } from "../src/getMetadata.js";

export const GET = async () => {
  const obj = await getMetadata({});
  const counts: { [x: string]: number } = {};
  Object.values(obj).map((item) => {
    item.categories?.map((category) => {
      if (counts[category] === undefined) {
        counts[category] = 1;
      } else {
        counts[category] += 1;
      }
    });
  });

  const sortedCounts = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .reduce(
      (previous, current) => {
        return { ...previous, [current[0]]: current[1] };
      },
      {} as { [x: string]: number },
    );

  return new Response(JSON.stringify(sortedCounts), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
