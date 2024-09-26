Unfortunately, [Cronjobs are too limited](https://github.com/vercel/vercel/issues/12058) on Vercel.

My cronjob config was:

```

"crons": [
{
    "path": "/api/myGithubCronjob",
    "schedule": "0 0 * * *"
},
{
    "path": "/api/cronjob",
    "schedule": "0 0 * * *"
}
],

```

Let's move to https://www.inngest.com or similar (check https://vercel.com/integrations/inngest) and make the cronjob run.

Learing: My code doesn't work as CJS.
Inngest doesn't work as ESM: ReferenceError: exports is not defined in ES module scope

Next day: Compared inngest with zeplo, trigger.dev, and upstash. Everyone of them has a subscription model which annoys me, except upstash. Upstash is a bit more barebones but since I have an API already, I think it may actually be better.

PRicing is a bit complex but I think I can design it in a way to fit within the free plan still... but even if not, paid plan is cheap as fuck.

https://upstash.com/docs/qstash/api/messages/batch

https://upstash.com/pricing/qstash Free has:

- 500 msg per day
- http connection timeout 15min (good for streams)
- max batch size: unknown, but max 1MB

All we really need is a batch of messages to be sent out in a single fetchcall (fan out)

# To reset...

- Go to https://console.upstash.com to the redis CLI and run `FLUSHDB`
- Go to vector db and remove all vectors in the namespace
- run `src/reset.cli.ts`

# How to obtain an OpenAPI from a SaaS website

This is my "algorithm" to find the OpenAPI for any given SaaS Service:

- We can scrape all subdomains of the site domain and try common openapi locations, e.g. `/openapi.json` or `/openapi.yaml` or `/swagger.json`
- As stated [here](https://stackoverflow.com/questions/41660658/openapi-or-swagger-json-auto-discovery) we could first figure out the api server, then check `/api-docs`
- Look at `/.well-known/schema-discovery` (as in https://github.com/zalando/restful-api-guidelines/pull/277/files)
- Request OPTIONS at `/` of the API address (see https://www.rfc-editor.org/rfc/rfc7231#section-4.3.7)
- We can find it by searching google for `site:[domain] "openapi"`
- If we can find a swaggersite but the spec isn't available as JSON, you can still find it in sources of swagger.
- In some other docs generators it's also available in sources.
- It might be available on github or anywhere else publicly hosted. try things like `site:github.com "[sitename]" "openapi"` or `site:github.com "[sitename]" "openapi.json"`
- If it's not available publicly but there are docs that are obviously created using an OpenAPI spec (such as from readme.com) we can open an issue in their github, email the developer, or contact the SaaS, asking for the spec.
- Some other people already explored them by scraping:
  - Google BigQuery
  - SwaggerHub API
  - APIS.Guru api: https://api.apis.guru/v2/list.json

I'll probably make this into a script later.

# Other strategies to obtain an OpenAPI

- Look in any of the api's SDKs for the source script. This is often directly inferred from the OpenAPI, or the OpenAPI can be inferred from it.
- Ask claude based on the above to generate the entire JSON Spec
- https://joolfe.github.io/postman-to-openapi/ may be useful (haven't tried)
