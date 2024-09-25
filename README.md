OpenAPI-Search combines multiple OpenAPIs in a fast, organized, and searchable interface.

OpenAPIs are effectively closed if there isn't an accessible way to find and use them. Big commercial API directories such as https://rapidapi.com are currently dominating the search results and the # of APIs indexed, leading many developers to a non-open API gateway. Open Source is far behind.

The best OpenAPI directory as of yet is https://apis.guru but this doesn't even reach 10% of the amount of listed APIs and there is many room for improvement.

The vision of https://openapisearch.com is to make OpenAPIs truly open by making it accessible (easy to find what you're looking for) and improving listing quality.

![](explorer.drawio.png)

# Goals

Targeted improvements compared to https://apis.guru:

- Semantic search
- Related APIs
- Programmatic Registry
- Improved Website
- Chat with OpenAPIs

Wishlist:

- E2E Testing of OpenAPIs
- ~~OpenAPI Firehose~~
- AI Crawler for OpenAPI Discovery
- AI Crawler to augment OpenAPI Metadata
  - Adds authentication + scope info
  - Adds useful links
  - Adds reviews
  - Adds pricing info, ratelimit info, etc

## Non-goals

- Automatically customise theming. A little is ok, but don't go to far as there may be
- Create a docs reference website like [readme.com](https://readme.com) (there are many)
- Add weird custom logic that is non-standard to the OpenAPI. Instead, I aim to create a layer on top of openapis to improve the implementation of the standard. I'll use [actionschema](https://actionschema.com) for this.

# TODO

Currently indexation has many errors and bad validation. **Improved api indexation and validation** is top priority

- There's still a bug in providerslug being slugified containing things like ':'. this shouldn't be removed!
- Add createdAt date to openapisearch storage
- Ensure daily cron is cheap/efficient
- ❌ openapisearch.com: Vector metadata doesn't fit for github.com and a dozen others. Let's debug the github.com one
- Ensure if metadata doesn't fit, we skip it.
- Remove all items that don't have metadata now to prevent downstream errors
- ❌ openapisearch.com: `/api/trakt.tv/openapi.json` failed fetching openapi { status: 200, statusText: 'OK' } **Lot of openapis can't be found yet are still added into the search results. we need to add validation so we don't create downstream problems**

I'm happy after all search results:

- are openapis that exist
- are in valid OpenAPI format

Then...

🤔 put chat away, is not needed to be a value proposition of this site...

🤔 email apis.guru

🤔 Shall I put actionschema.com live?

🤔 See [backlog](BACKLOG.md). much more to do
