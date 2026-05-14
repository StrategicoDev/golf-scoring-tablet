# Golf Scoring Tablet App

Tablet-first golf scoring web app with live Google Maps, GPS golfer marker, handicap-adjusted scoring, Stableford-style points, email+password auth, and per-user Supabase cloud save/load.

## Features

- Landscape tablet golf scorecard UI
- Google Maps JavaScript API satellite map
- Tap-to-set tee, green, layup, and manual golfer position
- Live GPS golfer marker using `navigator.geolocation.watchPosition()`
- Real distance calculations in metres from lat/lng
- GPS accuracy circle
- Player add/remove with editable names, handicaps, scores
- Gross, net, points, and game-vs-par calculations
- Local browser save/load
- Email + password auth via Supabase
- Per-user cloud save with multi-game load picker (list / load / delete)

## Project structure

```
index.html          markup + styles only
config.js           Supabase URL / anon key / Google Maps key (overwritten by Netlify build)
src/
  app.js            entrypoint + event wiring
  state.js          state object + local persistence + cloud row mapping
  scoring.js        handicap, Stableford, Haversine, helpers
  auth.js           Supabase email+password auth + session refresh
  cloud.js          per-user CRUD against public.golf_games
  map.js            Google Maps + fallback SVG map + GPS watch
  ui.js             render functions + toast + modal helpers
scripts/write-config.js  builds config.js from env vars at Netlify deploy time
supabase/migrations/     SQL for the golf_games table + RLS policies
```

## Local use

Because the app uses ES modules, open it via a local server (not file://):

```bash
python3 -m http.server 5173
```

Then open <http://localhost:5173>.

## Environment config (Netlify)

Netlify runs `npm run build`, which writes `config.js` from environment variables:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `GOOGLE_MAPS_API_KEY` (optional — also accepts paste in the UI)

The repo ships with a working `config.js` for the Skins Scorer Supabase project; Netlify overwrites it on build.

## GPS requirement

Modern tablet browsers require a secure origin for GPS:

- `https://...` works
- `localhost` works for testing
- LAN `http://192.168.x.x` is usually blocked for GPS

Use the Netlify HTTPS URL for field testing.

## Supabase backend

Table: `public.golf_games`, scoped to the signed-in user via RLS (`auth.uid() = user_id`).

Schema and policies live in [`supabase/migrations/20260514_golf_games.sql`](supabase/migrations/20260514_golf_games.sql) and have already been applied to the `gdegsibcmjqhxxnlzoed` project.

### Auth notes

- Email + password sign-up / sign-in via Supabase Auth.
- If you have email confirmation enabled in the Supabase dashboard, users must confirm before they can save.
- Session is persisted in localStorage and refreshed automatically before expiry.
