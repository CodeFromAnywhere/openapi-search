export const upCount = async (key: string, q: string) => {
  console.log("WAIT UNTIL Increase search queries");
  // add query to a set
  const encodedQuery = encodeURIComponent(q);
  const url = `${process.env.UPSTASH_REDIS_REST_URL}/zincrby/${key}/1/${encodedQuery}`;

  const start2 = Date.now();
  await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
    },
  }).then((res) => res.json());
  // });
  const end2 = Date.now();
  const duration2 = end2 - start2;
  console.log("finished upping", duration2);
};
