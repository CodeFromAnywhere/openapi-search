# OpenAPI Maintenance - 2024-09-02

- ✅ Get good logging for each provider into each operation parse of the pipeline, so I know when/why something isn't working.
- ✅ Add ability to filter on 'category'
- ✅ Ensure `&category=` gets applied if it's there
- ✅ Bring back the `apiManagementUrl`
- ✅ Pring pricing a bit more to the front
- ✅ Ensure function streams with controller so it can be a cronjob
- ✅ Make `/myGithubCronjob` which only does repos updated in last 15 minutes
- ✅ Tried cronjobs in prod, didn't work

# Registry - 2024-09-02

- ✅ Remove Redis dep by replacing scan with fetch
- ✅ Ensure to always also store the original URL if available
- ✅ Test: curl -N http://localhost:3000/jobs/storeProviders
- ✅ Improve openapi doc retrieval
- ✅ In proxy, allow for subset and yaml
- ✅ In my proxy, use converter if version is 2.x.x: https://converter.swagger.io/api/convert?url=OAS2_YAML_OR_JSON_URL
- ✅ Deprecate openapi-search, get pull backlog etc into search-operations
- ✅ Consume https://api.apis.guru/v2/list.json directly
- ✅ Finish openapi-store with `/set` validation and registry
- ✅ Allow for registering new openapis and pull from that storage too

# Metadata endpoint - 2024-09-02

- ✅ Retrieve gracefully each metadata key by doing it per 100 each time (limit request size 1MB)
- ✅ Database is bloated somehow, clean it up
- ✅ Merge that into a JSON Object.

# Provider Indexation - 2024-09-02

- ✅ Index not only operations, but also providers into a Vector Store.
- ✅ Made ticket: https://github.com/vercel/vercel/issues/12058 (let's wait for this a day, maybe I'm missing something)
- ✅ Install inngest or similar to run streaming api calls. May even be WAAAAAY faster because i'm not limited to 6 simulaneous fetches.
- ✅ Do cronjob properly by looking at updated ones in `metadata`. Now cronjob can be done hourly, potentially.

💯💯💯💯 PRIORITY 💯💯💯💯💯

❌ Make Inngest run in production, and run the hourly and daily mutliple times and check the results. **Got trouble gettting it to work due to the tsconfig setup. Decided to move to QSTash**

✅ Make an OpenAPI for https://upstash.com/docs/qstash/api/messages/batch and then SDK that uses fetch directly and uses CRON_SECRET Authorization by default if available. All I want to need to pass is the endpoint url and context. This can then be made typesafe as well. Add to `edge-util`

✅ Implement the above minimal thing and replace `inngest.ts`

✅ Do things with a daily CRON that then batches the long messages using upstash. Assume a single provider can be done in 1 stream.

✅ Run it and confirm upstash dbs are filled...

<!-- I now already have something to show! -->

# Optimisations - 2024-09-04

✅ Replace OpenAI Embedrequest with Upstash's best one to make it much faster.

✅ Look if I can remove Upstash Redis and simply use vector-store directly for metadata.

✅ During scraping, ensure to also get provider info from APIGuru and add that in into the provider info.

✅ Cleanup logo

✅ Use range query

✅ Cleanup indexing: no namespace.

✅ We only use upstash for generating the `/metadata` (due to the scan). Instead, use `vector /range`. Now remove upstash fully except for the counter

# Improved search - 2024-09-04

In search, add filters:

- ✅ to primary/apiguru category
- ✅ to all other categories
- ✅ to exact match for title or providerSlug or such
- ✅ If boolean `exact:true` weigh exact match 100%

# More backend - 2024-09-04

- ✅ Bring back suggestions endpoint
- ✅ Also count search result clicks and list that on homepage as 'popular'
- ✅ Add `/metadata?filter=new|updated|popular&category&categories` each giving a top 100
- ✅ In OpenAPI add operationId everywhere

# Build all Frontends

✅ Hope it works out at once! **No it doesn't. Claude Sonnet 3.5 isn't strong enough... Maybe the bigger one is. Also, there are probably still ways to chunk up my code further**

🟠 Test and iterate maybe on metadata or frontend if needed

🚫 Lets try to finish anthropic tool-use first, or make my own codeblock tool use. Then use middleware Claude + FetchURL to dev in english much easier.

- Metadata and search can be a single endpoint with everything optional, simplifying the spec
- Many small frontend improvements. Probably need html-web-components too.

🚫 Do indexation for all of them. Only do once...

# RELEASE

First priority is get in touch with Mike Ralphson before promoting! Maybe able to take over the ownership of the api directory repo including all stars. We can keep the name apis.guru and mention him, I'll just be the new maintainer.

<!--
This seems like a nice rounded up project.

From here on out continue with backend host so I can add "checkmark" functionality (verified, tested, apis)

The art of finishing
-->

# Improved OpenAPI Indexations (september 26th, 2024)

- ✅ Gather upstash openapis I already handmade before
- ✅ Ensure id generated is like `hackernews/newstories.json__get hackernews/item/{id}.json__get` ('/' as split character and all characters allowed in operationId? Or can we transform it to be more compatible)
- ✅ Confirm upstash is all included... also stripe, github, sendgrid
- ✅ Add providerSlug to semantic-operation-search
- ✅ Add providerSlug filter to semantic-operation-search
- ✅ Create easy way to reset openapi-search and semantic-operation-search using npm script or so
- ✅ Reset openapi-search and re-index all with minimal errors
- ✅ Reset semantic-operation-search and re-index - all with minimal errors
- ✅ Be aware of the errors that still occur and figure out ways to resolve those (see vercel logs + upstash logs)
- ✅ Confirm that, now the operationId format is consistent everywhere and elegant.
- ✅ Look at openapisearch and operationsearch and ensure the pipelines work and I have newest APIs
- ✅ Generate html for `openapi-search-text` and put html into openapisearch.com (manually for now)

🎉🎉🎉 At this point actionschema.com and openapisearch.com are "shareable". 🎉🎉🎉

# sept 26 refactor: MAKING OPENAPISEARCH STABLE

- ✅ improve openapisearch index so its sync is almost optimal
- ✅ Ensure metadata fits
- ✅ Ensure daily cron is cheap/efficient
- ✅ make openapi-search work within CJS context
- ✅ Add openapisearch daily url check and update isOpenapiInvalid accordingly.
- ✅ Ensure metadata exposes 'inserted' correctly

## Calculated data

Create `calculateProperties` on backend to augment metadata, stored upon updating a provider in separate .calculated key

- ✅ Fetch OpenAPI and convert to 3.x
- ✅ Mark as invalid if it can't be made 3.x
- ✅ Add serverUrl to the provider too, even if no servers[0].url is found (then use the openapi domain)
- ✅ Generate openapi summary of OpenAPI + some metadta we already had
