# Golf Scoring Tablet App

Tablet-first golf scoring web app with live Google Maps, GPS golfer marker, handicap-adjusted scoring, Stableford-style points, and Supabase cloud save/load.

## Features

- Landscape tablet golf scorecard UI
- Google Maps JavaScript API satellite map
- Tap-to-set tee, green, layup, and manual golfer position
- Live GPS golfer marker using `navigator.geolocation.watchPosition()`
- Real distance calculations in metres from lat/lng
- GPS accuracy circle
- Player add/remove
- Editable player names, handicaps, and scores
- Gross, net, points, and game-vs-par calculations
- Local browser save/load
- Supabase cloud save/load

## Local use

Open `index.html` directly, or run a tiny local server:

```bash
python3 -m http.server 5173
```

Then open:

```text
http://localhost:5173
```

## Environment config

Netlify runs `npm run build`, which writes `config.js` from environment variables:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `GOOGLE_MAPS_API_KEY` optional

Without config, the app still works locally with fallback map/local storage, and the Google Maps key can be pasted in the UI.

## GPS requirement

Modern tablet browsers require a secure origin for GPS:

- `https://...` works
- `localhost` works for testing
- LAN `http://192.168.x.x` is usually blocked for GPS

Use the Netlify HTTPS URL for field testing.

## Supabase backend

Uses table:

```text
public.golf_games
```

The current prototype uses public anon RLS for read/insert/update because there is no login layer yet. Add auth before using it as a public production scoring system.
