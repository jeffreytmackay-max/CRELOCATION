# Site Selection Explorer

Internal decision-support tool for the **TransMedics OCS Network** real-estate /
site-selection team. Weight the factors that matter for a new office/lab
location, then rank candidate submarkets in a metro against each other on a live
weighted score — shown on an interactive map alongside the relevant transplant
centers, airports, and your current office as reference points.

This is a React + TypeScript implementation of the Claude-designed prototype
(`Site Selection Explorer (App).html`), rebuilt on a real component/state/data
layer with [react-leaflet](https://react-leaflet.js.org/) for the map.

![Site Selection Explorer](docs/screenshot.png)

## Features

- **Live weighted scoring.** Six factor sliders (transplant centers, airport
  access, staff commute, real-estate supply, climate/regulatory risk, crime &
  safety) write raw 0–100 weights that are normalized to 100%. Composite =
  Σ(rawFactorScore × normalizedWeight). Changing any slider re-scores, re-ranks,
  and re-sizes/re-colors the map pins instantly. (Sites saved before a factor
  existed treat it as a neutral score until set.)
- **Interactive map.** Pannable OpenStreetMap basemap with score-scaled candidate
  pins, transplant-center and airport markers, and an optional office diamond.
  Click a pin or a ranking row to select a site. **Fit all sites** zooms/pans to
  frame every candidate across the greater metro at once.
- **Greater-metro exploration.** Candidate pins are free-form — drop them
  anywhere in the metro, not just the core city. Each candidate carries an
  editable **city / area** label (e.g. "The Woodlands, TX") shown in the ranking
  and detail panel, so submarkets in surrounding municipalities read clearly.
- **Search-to-add (geocoding).** Type an address or city under Candidate
  locations to geocode it (Google Geocoding API) and drop a scored candidate site
  there — the quickest way to reach surrounding suburbs by name. Enable the
  **Geocoding API** on the key.
- **Edit any site.** An **Edit** toggle in the detail panel lets you set each
  factor score (0–100, re-scores live) and edit the name, area, notes, and facts
  (asking rent, available space, …) — for candidate sites and the office. This is
  how you put in real figures, since there's no live real-estate data feed.
- **Office benchmark.** Enable the current office to inject it into the ranked
  list as a "Current" pseudo-site scored on the same factors.
- **Add on map.** Drop new candidate sites, transplant centers, airports, or
  reposition your office by clicking the map. Add new metros via the Add-city
  modal.
- **Find nearby.** Auto-discover transplant centers/hospitals and airports around
  the metro via the **Google Places API** and add them to the reference points
  (de-duped against existing ones). Uses the same key as drive times — enable the
  **Places API** on it. See [Environment variables](#environment-variables).
- **Drive times (traffic-aware).** Per-site vs. office drive-time comparison
  with a live Δ (green when closer than the office, crimson when farther).
  **Auto-fill** computes driving times from the site and office to every
  transplant center and airport using the **Google Distance Matrix API** with
  live/predictive traffic for a chosen departure time (now, or a typical weekday
  8am / noon / 5pm). Values remain editable by hand. Requires a Google Maps API
  key — see [Environment variables](#environment-variables).
- **Staff locations.** Record how many employees live where (city / state / ZIP +
  headcount) per metro, with a live total — context for the staff-commute factor.
  Managed in the Reference points panel. **Plot on map** geocodes each entry
  (Google Geocoding API) and shows it as a green headcount marker; a "Staff
  locations" layer toggle shows/hides them.
- **Persistence.** The full state autosaves to `localStorage`. Export downloads
  it as `site-selection-data.json`; Import restores from such a file; Reset data
  restores the seed sample.
- **Responsive / iOS-ready.** The desktop three-column layout collapses on phones
  (≤820px) into a **Weights / Map / Details** tab switch, with a full-screen
  Reference-points sheet. Handles the iOS Safari `100dvh` toolbar, notch/home
  safe-areas, 16px inputs (no focus-zoom), and touch targets.

## Tech stack

| Concern        | Choice                                             |
| -------------- | -------------------------------------------------- |
| Build tool     | [Vite](https://vite.dev/)                          |
| UI             | React 18 + TypeScript                              |
| Map            | Leaflet 1.9 via react-leaflet 4                    |
| State          | React Context + a single immutable state store     |
| Persistence    | `localStorage` + JSON export/import                |
| Design tokens  | TransMedics design system (reconstructed as CSS custom properties) |

## Getting started

```bash
npm install
npm run dev      # start the dev server (http://localhost:5173)
npm run build    # type-check + production build to dist/
npm run preview  # preview the production build
```

## Environment variables

| Variable              | Where            | Purpose                                                        |
| --------------------- | ---------------- | -------------------------------------------------------------- |
| `GOOGLE_MAPS_API_KEY` | server-side only | Drive-time auto-fill (`/api/drivetimes`, Distance Matrix API), Find-nearby discovery (`/api/places`, Places API), and search-to-add (`/api/geocode`, Geocoding API). Never exposed to the browser. |

**Vercel:** Project → Settings → Environment Variables → add `GOOGLE_MAPS_API_KEY`
(all environments) → redeploy. In the [Google Cloud console](https://console.cloud.google.com/),
enable the **Distance Matrix API**, **Places API**, and **Geocoding API** on the
key, and restrict it.

**Local:** copy `.env.example` to `.env`, fill in the key, and run `vercel dev`
(the `/api` functions do not run under plain `vite dev`). See `.env.example`.

Without a key the app still works — the **Auto-fill** and **Find nearby** buttons
return a clear "add a key" message, and everything else is unaffected.

## Project structure

```
api/
  drivetimes.js         # Vercel function: Google Distance Matrix proxy (traffic)
  places.js             # Vercel function: Google Places proxy (find nearby refs)
  geocode.js            # Vercel function: Google Geocoding proxy (search-to-add)
src/
  main.tsx              # entry
  App.tsx               # layout: header, nav, three columns, overlays
  store.tsx             # AppProvider — state, derived scoring, all actions
  types.ts              # domain model
  data/
    factors.ts          # the six weighting factors + defaults + icons
    seed.ts             # sample cities (Houston, San Ramon, San Diego, LA)
  lib/
    scoring.ts          # normalize / composite / scoreCity / scoreColor
    storage.ts          # load / save / export / import
    drivetimes.ts       # client for /api/drivetimes + departure-time presets
    places.ts           # client for /api/places (find nearby)
    geocode.ts          # client for /api/geocode (search-to-add)
  components/
    Header.tsx          # brand + data actions
    CityNav.tsx         # city tabs + reference-points toggle
    LeftRail.tsx        # factor weighting + ranked candidate list
    MapView.tsx         # react-leaflet map, markers, tooltips, overlays
    Legend.tsx          # score-band + marker-type legend
    RightRail.tsx       # selected-site detail + factor breakdown + drive times
    ReferencePanel.tsx  # editable transplant centers / airports / office
    AddCityModal.tsx    # add-a-metro modal
  styles/
    tokens.css          # design-system custom properties
    global.css          # base + component styles (sliders, buttons, tooltips)
```

## Design tokens

The prototype linked a private `_ds/tmdx-collateral-…` design-system bundle that
is not part of this repository. `src/styles/tokens.css` reconstructs those token
values (crimson `#9D2235`, slate `#44546A`, charcoal `#302F32`, the score-color
scale, Mulish type, etc.) from the design handoff so the UI renders identically.
When the real design-system package is available, replace that file with its
`tokens/*.css` imports and swap the placeholder "m" monogram for the TransMedics
lockup.

## Scoring

- **Weights** are raw 0–100; each factor's effective weight is its share of the
  sum (`normalize`).
- **Composite** for a site = `Σ(score[factor] × normalizedWeight[factor])`,
  rounded.
- **Score colors:** `≥80` crimson (excellent) · `≥72` coral (strong) ·
  `≥64` peach (fair) · else grey (weak).

## Production gaps

Deliberate placeholders carried over from the prototype, to close for
production:

1. **Drive times** — ✅ done. Traffic-aware auto-fill via the Google Distance
   Matrix API (`/api/drivetimes`); manual override still supported. Still to do:
   drive **distances** (miles) alongside times, and caching to limit API calls.
2. **Geocoding** — ✅ done. Search-to-add geocodes typed addresses via the Google
   Geocoding API (`/api/geocode`); click-to-place is still available too.
   Find-nearby (`/api/places`) also auto-discovers transplant centers & airports.
3. **Backend persistence** + multi-user projects/sharing (replace
   `localStorage`/JSON).
4. Marker **drag-to-reposition**, undo, and validation.
5. Editable **factor scores & facts** — ✅ done. The detail panel has an **Edit**
   mode to set each factor score (0–100, live re-score) and edit the site name,
   area, notes, and facts (asking rent, space, …) — for candidate sites and the
   office benchmark. Real-estate figures are still entered by hand (no CRE data
   feed); a commercial provider (CoStar, Crexi, …) could auto-fill them.

## Attribution

Map tiles © OpenStreetMap contributors. The OpenStreetMap attribution control
must be kept. For production, consider a commercial tile provider (Mapbox,
Google) with a styled basemap and an API key.
