# Priority

- Fix registration (/set) and ensure it doesn't get abused

# More calculations

I've come up with lots of stuff I want to know about OpenAPIs and company behind it. Indexing this and keeping this info up-to-date could become central to creating more high-quality information.

- Is the API working? We need a test API key from the creator in order to verify its functionality.
- Find links such as docs, blogs, about, etc
- Find pricing info, ratelimit info, etc
- Find company behind it programatically
  - by going to main domain of serverUrl
  - use API to get domain authority, which is a clear indicator of credibility of the api (expensive!)
  - use domain metadata for a good company description
- Create lists such as 'APIs for LLM' and 'APIs for domain registration' etc etc. Probably is quite a process to do this well in a scalable way. Think about it.

# Promotion

Plan a full day on this!!!!

- Create email list (with details) from all openapi.info.contact emails
- Make an SEO Strategy
- Put in some github discussions
- Find other key figures who would be excited by this and DM them
- Brainstorm more with claude

# 💡 Factored search

- Weigh in the string-match to the final score, creating 'hybrid search'
- Weigh in other things perceived as score, such as domain authority

# 💡 Take in other OpenAPI registries

This whole thing should be decentralisable. Both the user ones and the global one should be able to subscribe to other registries with a certain synchronisation frequency. If I can do this nicely, we can add in things many cool things, especially for the user this is useful. Another way could be a proactive push, but both strategies have merit. I need a good synchronisation strategy.
