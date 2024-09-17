# Promotion

Plan a full day on this!!!!

- Create email list (with details) from all openapi.info.contact emails
- Make an SEO Strategy
- Put in some github discussions
- Find other key figures who would be excited by this and DM them
- Brainstorm more with claude

# Shuffle

https://developer.mozilla.org/en-US/docs/Web/API/Accelerometer

# Factor search

- Weigh in the string-match to the final score, creating 'hybrid search'
- Weigh in other things perceived as score, such as domain authority

# Calculated data

Create `calculateProperties` on backend to augment metadata, stored upon updating a provider in separate .calculated key

- Find docs
- Find company behind it programatically
  - by going to main domain of serverUrl
  - use API to get domain authority, which is a clear indicator of credibility of the api (expensive!)
  - use domain metadata for a good company description
- Fetch OpenAPI and convert to 3.x
- Mark as invalid if it can't be made 3.x
- Add serverUrl to the provider too, even if no servers[0].url is found (then use the openapi domain)
- Generate openapi summary of OpenAPI + some metadta we already had
- Every provider page has 10 related providers out of 50 using LLM
- Create improved short description based on openapi summary. Use ChatGPT GPT-4o-mini
- conversation starters

Store it all alongside in `metadata.` or `generated.`

Use generated description for vector.

# Chat

Let's create multiple GPT4O chats:

- 1 for searching through providers, categories, operations, and related. This can be brought forward nicely.
- 1 for each OpenAPI: has openapi-summary in-context, can redirect to take action in a specific operation.

# Internal APIs

<!-- CRUCIAL FOR BUILDING ON TOP OF YOUR OWN DATABASE OR OTHER INTERNAL STORES LIKE PRIVATE REPOS -->

- Create a single registry for internal APIs too that people can submit to with a user auth token.
- Can be hosted at {slug}.openapisearch.com/{providerSlug}/openapi.json
- Later this can be sharded but that's not needed now.

# Take in other OpenAPI registries

This whole thing should be decentralisable. Both the user ones and the global one should be able to subscribe to other registries with a certain synchronisation frequency. If I can do this nicely, we can add in things many cool things, especially for the user this is useful. Another way could be a proactive push, but both strategies have merit. I need a good synchronisation strategy.

# Opinions about companies

I think this is super cool to do with podscan. Let's analyse transcripts using my mapper and try to find mentions of companies...

# Crawler

- Use claude to make a start for a crawler to find an openapi on any given domain
- Also make a start for OpenAPI augmentation crawling. Can probably get very far with a google SERP agent
- Create a page for guidelines about making your OpenAPIs as explorable as possible

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
