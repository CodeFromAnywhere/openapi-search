// to alter the hash when version changes
const version = "v4";

function generateDeterministicString(input: string): string {
  // Simple hash function
  function simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  // Generate a longer string based on the hash
  function expandString(num: number): string {
    const charset = "abcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    while (result.length < 48) {
      num = simpleHash(num.toString());
      result += charset[num % charset.length];
    }
    return result;
  }

  // Get the initial hash
  const hash = simpleHash(input);

  // Expand the hash to a 48-character string
  return expandString(hash);
}

export const generateHtmlMiddleware = async (request: Request) => {
  const url = new URL(request.url);
  const chunks = url.pathname.split(".");
  const requestedFormat = chunks.pop();

  const start = Date.now();

  if (request.headers.get("X-Original-Format") !== null) {
    // prevent infinite loop
    return;
  }

  if (requestedFormat !== "html") {
    return;
  }

  console.log("looking for " + requestedFormat, request.url);

  const originalResponse = await fetch(request.url, {
    headers: { "X-Original-Format": requestedFormat },
  });

  if (originalResponse.ok) {
    // NB: Unfortunately it's hard to reduce this time further... Unless we can avoid middleware for static sites.
    const end = Date.now();
    console.log(`${url.href} - Already have it. Wasted ms:`, end - start);
    return;
  }

  if (!process.env.ANTHROPIC_TOKEN) {
    return new Response("Please add an ANTHROPIC_TOKEN to your env", {
      status: 500,
    });
  }

  const alternateUrl = `${url.origin}${url.pathname.replace(".html", ".md")}`;
  console.log("not found. checking", alternateUrl);
  const contentResponse = await fetch(alternateUrl, {
    headers: { "X-Original-Format": requestedFormat },
  });

  if (!contentResponse.ok) {
    // if it didn't exist but there's no alternate either
    return;
  }

  const rawContent = await contentResponse.text();

  // TODO: Also take into account the profile.json etag or content to ensure all websites change when the agent itself changes.
  const hash = generateDeterministicString(rawContent + version);
  const contentUrl = `https://${hash}.gptideas.com/${hash}.html`;

  console.log(`looking for: ${contentUrl}`);
  const exists = await fetch(contentUrl)
    .then(async (res) => {
      return { ok: res.ok, content: await res.text() };
    })
    .catch((e) => {
      return { ok: false, content: undefined };
    });

  if (exists.ok && exists.content) {
    console.log("Found alternative with hash");

    return new Response(exists.content, {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
  }

  return new Response(
    new ReadableStream({
      start: async (controller) => {
        // TODO: call the codegen agent, and stream it instead of directly returning :)
        const anthropicResult = await fetch(
          `https://chat.actionschema.com/${encodeURIComponent(
            "https://openapi-code-agent.vercel.app/openapi.json",
          )}/chat/completions`,
          {
            body: JSON.stringify({
              stream: true,
              model: "claude-3-5-sonnet-20240620",
              messages: [
                {
                  role: "system",
                  content: `You're a website builder agent.

You always first fetch the urls provided using the fetchurl tool. Afterwards, make a vanilla HTML + TailwindCDN + CSS + JS website with the following requirements:

- everything is always stored as much as possible in localStorage and editable in settings
- for icons, use font awesome from https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css
- If possible, add a share button that uses twitter intent to share the website with a nice caption
- ensure to use add clear loading indicators
- always respond with a full new HTML page in a HTML codeblock`,
                },
                { role: "user", content: rawContent },
              ],
            }),
            method: "POST",
            headers: {
              "X-BASEPATH": "https://anthropic.actionschema.com",
              Authorization: `Bearer ${process.env.ANTHROPIC_TOKEN}`,
            },
          },
        );

        console.log("Gonna build", alternateUrl);

        const reader = anthropicResult.body?.getReader();

        if (!reader) {
          controller.close();
          return;
        }

        let response = "";
        let html = "";
        let buffer = "";
        const decoder = new TextDecoder();
        let isInCodeBlock = false;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.includes("[DONE]")) continue;

            if (line.startsWith("data:")) {
              try {
                const data = JSON.parse(line.slice(5));

                if (
                  data.choices &&
                  data.choices[0].delta &&
                  data.choices[0].delta.content
                ) {
                  const content = data.choices[0].delta.content;

                  if (response.includes("</html>") && isInCodeBlock) {
                    isInCodeBlock = false;
                    console.log("DONE with HTML");
                  }

                  response += content;
                  // Check for opening and closing code block
                  if (content.includes("```")) {
                    isInCodeBlock = true;
                    continue;
                  }

                  // } else if (content.includes("```") && isInCodeBlock) {
                  //   isInCodeBlock = false;
                  //   continue; // Skip the closing tag
                  // }

                  // Stream HTML content
                  if (isInCodeBlock) {
                    const encodedContent = new TextEncoder().encode(content);
                    controller.enqueue(encodedContent);
                    html += content;
                  }
                }
              } catch (e) {
                console.error("Error parsing JSON:", line.slice(5), e);
              }
            }
          }
        }

        console.log("SAVING");
        // set the full html to cache for next time
        const result = await fetch("https://content.actionschema.com/set", {
          method: "POST",
          body: JSON.stringify({
            slug: hash,
            code: html,
            prompt: rawContent,
            extension: "html",
          }),
        }).then((res) => res.text());

        console.log("Saved. Really done now");
        controller.close();
      },
    }),
    {
      status: 200,
      headers: {
        Connection: "keep-alive",
        "Content-Encoding": "none",
        "Cache-Control": "no-cache, no-transform",
        "Content-Type": "text/html; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    },
  );
};
