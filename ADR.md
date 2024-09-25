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
