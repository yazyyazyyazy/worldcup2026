# World Cup '26 — auto-update kit

This makes your bracket site refresh itself: a free scheduled job fetches results
and writes them to `results.json`, and the site reads that file every couple of
minutes — greying out losers, adding result cards, advancing the bracket, and
re-tallying points, all with no manual editing.

## What's in here
- `results.json` — the file the site reads (seeded with Canada beating South Africa).
- `scripts/refresh-results.mjs` — fetches WC results from football-data.org and rewrites `results.json`.
- `.github/workflows/update-results.yml` — runs the fetcher every 20 minutes, for free.

## One-time setup (about 5 minutes)

1. **Make a GitHub repo** and put these in it:
   - your site, renamed `index.html` (so the URL is clean)
   - `results.json`
   - `scripts/refresh-results.mjs`
   - `.github/workflows/update-results.yml`

2. **Get a free API token** at https://www.football-data.org/client/register
   (free forever, no card — the World Cup is on the free tier).

3. **Add the token as a secret:** repo → Settings → Secrets and variables → Actions →
   New repository secret. Name it `FD_TOKEN`, paste your token.

4. **Turn on GitHub Pages:** repo → Settings → Pages → Deploy from branch → `main` / root.
   Your site goes live at `https://<you>.github.io/<repo>/`.

5. **That's it.** The Action runs every 20 min (you can also trigger it manually under the
   Actions tab → "Update World Cup results" → Run workflow). The page polls `results.json`
   every 2 minutes, so an open tab updates on its own.

## Good to know
- football-data.org allows 10 requests/min on free — the job uses one call per run, so you're fine.
- It's free for non-commercial use (which this is).
- If a finished match doesn't show up on the site, it's almost always a 3-letter team-code
  mismatch (e.g. the feed calls Algeria `DZA`, we call it `ALG`). The script already maps the
  common ones in its `ALIAS` table — add any stragglers there, or send them to me and I'll patch it.
- Prefer Netlify? You can do the same thing with a Netlify Scheduled Function instead of the
  GitHub Action — ask and I'll write that version.

## No-setup fallback
Don't want to run any of this? Skip the kit entirely. The site already ships with results
baked in; just send me a "update the scores" and I'll fetch the latest and hand you a fresh file.
