# PUBG Roast

Astro site deployed as a Cloudflare Worker that pulls a player's PUBG lifetime, ranked,
weapon-mastery, and survival-mastery stats and turns them into shareable
"roast cards" with a 0-100 Roast Score. Results are cached in D1 per
`(accountId, platform)`, so looking up the same player twice doesn't hit the
PUBG API again until the cache entry expires (`CACHE_TTL_HOURS`, default 6).

I built and reviewed this offline (no live network/Cloudflare access in my
environment), so treat the first `npm install` + `astro build` as your real
verification pass — flag anything that doesn't build cleanly and I'll fix it.

## What's included / what isn't

- ✅ Lifetime stats, ranked stats, weapon mastery, survival mastery — all wired up.
- ✅ D1 caching so repeat lookups skip the PUBG API entirely.
- ✅ Roast score algorithm + paginated, shareable roast cards.
- ⚠️ **Per-map stats are not included.** The PUBG API doesn't expose them on
  any of the endpoints you shared — the only way to get them is to pull and
  parse individual match telemetry (hundreds of matches per player, heavy on
  rate limits). The roast engine has a `maps` card slot ready; wire in
  `/matches/{id}` + telemetry parsing if you want it filled in later.

## 1. Get a PUBG API key

Create one at https://developer.pubg.com — free tier is rate-limited
(historically 10 req/min), which is exactly why the D1 cache matters here.

## 2. Install dependencies

```bash
npm install
```

## 3. Create the D1 database

```bash
npx wrangler d1 create pubg-roast
```

This prints a `database_id`. Copy it into `wrangler.toml`, replacing
`REPLACE_WITH_YOUR_D1_DATABASE_ID`.

Apply the schema to both local and remote D1:

```bash
npm run db:init:local    # for local dev (`astro dev` / `npm run preview`)
npm run db:init:remote   # for the deployed database
```

## 4. Set your API key

Local dev:

```bash
cp .dev.vars.example .dev.vars
# then edit .dev.vars and paste your real PUBG_API_KEY
```

Production:

```bash
npx wrangler secret put PUBG_API_KEY
# paste your key when prompted — this creates the pubg-roast Worker
# if it doesn't exist yet, using the `name` from wrangler.toml
```

## 5. Run it locally

```bash
npm run dev
```

`astro.config.mjs` has `platformProxy.enabled: true`, so `astro dev` can see
your local D1 binding and `.dev.vars` secrets the same way it would on
Cloudflare. To test the actual built Worker locally (closer to production),
use `npm run preview` instead, which runs `astro build` then `wrangler dev`.

## 6. Deploy — Workers, not Pages

This project deploys as a **Cloudflare Worker with static assets**, not a
Pages project. Workers now serves static files natively and is Cloudflare's
current recommendation for new full-stack sites (SSR + bindings like D1) —
Pages still works but isn't where new platform features land anymore. The
`[assets]` block and `main` entry in `wrangler.toml` are already set up for
this.

```bash
npm run deploy
```

This runs `astro build` (producing `dist/_worker.js/index.js` as the Worker
entry and the rest of `dist/` as static assets) then `wrangler deploy`. No
separate "create a Pages project" step, no dashboard binding step — the D1
binding in `wrangler.toml` is picked up directly. First deploy will prompt
you to log in (`wrangler login`) if you haven't already.

Your site goes live at `https://pubg-roast.<your-subdomain>.workers.dev`
(or attach a custom domain from **Workers & Pages → pubg-roast → Settings →
Domains & Routes**).

If Cloudflare's tooling has moved past this by the time you read it, check
`wrangler deploy --help` / the Cloudflare Workers docs — the D1
create/deploy/secret commands above have been stable for a long time, but
Cloudflare does reshuffle deployment UX periodically.

## How the roast score works

There's no public PUBG leaderboard/percentile endpoint, so the score isn't
graded against real population data — it's an opinionated heuristic
(`BENCH` constants in `src/lib/roastEngine.ts`) tuned to feel fair for a
roast site. Tune those numbers freely; nothing else depends on them being
"correct." Higher score = more roastable.

## Project layout

```
src/
  lib/
    types.ts        PUBG API + roast type definitions
    pubgApi.ts       Fetch wrapper for the PUBG API
    roastEngine.ts   Stats -> roast cards + score
    db.ts            D1 read/write helpers (the caching layer)
    getRoast.ts      Orchestrator: cache check -> API calls -> cache write
  components/
    RoastCard.astro  Single roast card + "copy this roast" button
  pages/
    index.astro          Search form
    api/go.ts            Normalizes input, redirects to /r/[platform]/[name]
    r/[platform]/[name].astro   SSR roast page, paginated, shareable URL
  styles/global.css   Design system
schema.sql            D1 schema (player_cache, lookup_log)
wrangler.toml          Cloudflare config incl. D1 binding
```
