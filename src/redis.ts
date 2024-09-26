import { tryParseJson } from "./edge-util.js";

// export const getUpstashRedisRangeKeys = async (baseKey: string | undefined) => {
//   const redis = Redis.fromEnv();
//   let cursor: string = "0";
//   let allKeys: string[] = [];
//   let limit = 0;

//   // Temporarily allow max 10 pages, which is 10 api calls.
//   while (limit < 20) {
//     limit = limit + 1;
//     const result = await redis.scan(cursor, {
//       match: baseKey ? `${baseKey}*` : "*",
//       count: 1000,
//     });

//     const [newCursor, newKeys] = result;
//     allKeys = allKeys.concat(newKeys);

//     if (
//       newCursor === "0" ||
//       !newCursor ||
//       String(cursor) === String(newCursor)
//     ) {
//       console.log({ newCursor }, "same. BREAK");
//       break;
//     }

//     console.log(
//       `${cursor}!==${newCursor}. Continue with ${newCursor}. Limit is ${limit}`,
//       // result,
//     );

//     cursor = newCursor;
//   }

//   return allKeys;
// };

export const redis = {
  mget: async <T>(keys: string[], maxPerRequest: number) => {
    const requestKeys =
      keys.length > maxPerRequest
        ? new Array(Math.ceil(keys.length / maxPerRequest))
            .fill(null)
            .map((_, index) =>
              keys.slice(
                index * maxPerRequest,
                index * maxPerRequest + maxPerRequest,
              ),
            )
        : [keys];

    console.log(keys.length, requestKeys.length, maxPerRequest);

    const list = await Promise.all(
      requestKeys.map(async (keys) => {
        const idUrls = keys.map((x) => encodeURIComponent(x)).join("/");

        const json = await fetch(
          `${process.env.UPSTASH_REDIS_REST_URL}/mget/${idUrls}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
            },
          },
        ).then((res) => res.json());

        if (json.error) {
          console.error("mget", json.error);
        }

        return json.result?.map((x: any) => tryParseJson<T>(x));
      }),
    );

    return list.flat() as T[];
  },

  get: async <T>(key: string) => {
    const upstashUrl = `${process.env.UPSTASH_REDIS_REST_URL}/get/${key}`;
    const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    const headers = { Authorization: `Bearer ${upstashToken}` };
    const response = await fetch(upstashUrl, { headers });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const content: T = JSON.parse(data.result);
    return content;
  },
  // scan: async (match: string | undefined) => {
  //   return getUpstashRedisRangeKeys(match);
  // },
  // scan: async (match: string) => {
  //   let cursor: string = "0";
  //   let allKeys: string[] = [];
  //   let limit = 0;

  //   while (limit < 10) {
  //     limit = limit + 1;

  //     const upstashUrl = `${process.env.UPSTASH_REDIS_REST_URL}/scan/${cursor}`;

  //     const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  //     const headers = { Authorization: `Bearer ${upstashToken}` };
  //     const response = await fetch(upstashUrl, {
  //       body: JSON.stringify({ match: match + "*", limit: 1000 }),
  //       method: "POST",
  //       headers,
  //     });

  //     if (!response.ok) {
  //       console.log(
  //         upstashUrl,
  //         response.status,
  //         response.statusText,
  //         await response.text(),
  //       );
  //       return null;
  //     }
  //     const data = await response.json();
  //     console.log({ data });

  //     const [newCursor, newKeys] = data.result;

  //     allKeys = allKeys.concat(newKeys);

  //     if (!newCursor || String(cursor) === String(newCursor)) {
  //       console.log({ newCursor }, "same. BREAK");
  //       break;
  //     }
  //     console.log(
  //       `${cursor}!==${newCursor}. Continue with ${newCursor}. Limit is ${limit}`,
  //       data.result,
  //     );
  //     cursor = newCursor;
  //   }

  //   return allKeys;
  // },
  set: async (key: string, value: any) => {
    const storeCodeResponse = await fetch(
      `${process.env.UPSTASH_REDIS_REST_URL}/set/${key}`,
      {
        method: "POST",
        body: JSON.stringify(value),
        headers: {
          Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
        },
      },
    );

    if (!storeCodeResponse.ok) {
      console.log(
        "not stored",
        storeCodeResponse.status,
        storeCodeResponse.statusText,
        await storeCodeResponse.text(),
      );
    }

    return;
  },

  // New function to remove multiple keys
  mdel: async (keys: string[]) => {
    const upstashUrl = `${process.env.UPSTASH_REDIS_REST_URL}/pipeline`;
    const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    const pipeline = keys.map((key) => ["del", key] as ["del", string]);

    const response = await fetch(upstashUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${upstashToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(pipeline),
    });

    if (!response.ok) {
      console.error("mdel failed", response.status, response.statusText);
      return false;
    }

    const result = await response.json();

    if (result.error) {
      console.error("mdel error", result.error);
      return false;
    }

    // Check if all keys were successfully deleted
    // const allDeleted = result.result.every((res: any) => res === 1);
    return true;
  },
};
