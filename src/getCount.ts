export async function getCountMatches(
  key: string,
  prefix: string,
  limit: number = 9,
): Promise<string[] | undefined> {
  const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
  const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
    return;
  }

  const encodedPrefix = encodeURIComponent(`[${prefix}`);
  const encodedPrefixEnd = encodeURIComponent(`[${prefix}\xff`);
  const url = `${UPSTASH_REDIS_REST_URL}/zrangebylex/${key}/${encodedPrefix}/${encodedPrefixEnd}/LIMIT/0/${limit}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data.result;
}

export async function getTopCount(
  key: string,
  limit: number = 9,
): Promise<string[] | undefined> {
  const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
  const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
    return;
  }
  const url = `${UPSTASH_REDIS_REST_URL}/zrevrange/${key}/0/${limit - 1}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data.result;
}
