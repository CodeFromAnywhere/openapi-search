const qStashToken = process.env.QSTASH_TOKEN;

const getAllEvents = async (cursor?: string): Promise<any[] | undefined> => {
  const urlSuffix =
    "&url=" + encodeURIComponent("https://openapisearch.com/storeOpenapi");
  const cursorSuffix = cursor ? `&cursor=${cursor}` : "";

  const eventsResponse = await fetch(
    "https://qstash.upstash.io/v2/events?state=RETRY" +
      urlSuffix +
      cursorSuffix,
    {
      headers: {
        Authorization: `Bearer ${qStashToken}`,
      },
      method: "GET",
    },
  ).then(async (res) => {
    if (!res.ok) {
      console.log(res.status, res.statusText, await res.text());
      return undefined;
    }
    return res.json() as Promise<{ cursor: string; events: any[] }>;
  });

  if (!eventsResponse) {
    return;
  }

  if (eventsResponse.cursor && eventsResponse.events.length === 1000) {
    const next = await getAllEvents(eventsResponse.cursor);
    if (next) {
      return eventsResponse.events.concat(next);
    }
    return eventsResponse.events;
  }

  return eventsResponse.events;
};

const main = async () => {
  if (!qStashToken) {
    console.log("NO QSTASH_TOKEN");
    return;
  }

  const events = await getAllEvents();

  if (!events) {
    return;
  }
  console.log(
    `events;`,
    events.map((x) => x.state),
    events.length,
  );

  const response = await fetch("https://qstash.upstash.io/v2/messages", {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${qStashToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messageIds: events.map((x) => x.messageId),
    }),
  }).then(async (res) => {
    if (!res.ok) {
      console.log(res.status, res.statusText, await res.text());
      return;
    }
    return res.json();
  });

  console.log(response);
};

main();
