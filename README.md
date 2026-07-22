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

- **Live weighted scoring.** Five factor sliders (transplant centers, airport
  access, staff commute, real-estate supply, climate/regulatory risk) write raw
  0–100 weights that are normalized to 100%. Composite =
  Σ(rawFactorScore × normalizedWeight). Changing any slider re-scores, re-ranks,
  and re-sizes/re-colors the map pins instantly.
- **Interactive map.** Pannable OpenStreetMap basemap with score-scaled candidate
  pins, transplant-center and airport markers, and an optional office diamond.
  Click a pin or a ranking row to select a site.
- **Office benchmark.** Enable the current office to inject it into the ranked
  list as a "Current" pseudo-site scored on the same factors.
- **Add on map.** Drop new candidate sites, transplant centers, airports, or
  reposition your office by clicking the map. Add new metros via the Add-city
  modal.
- **Drive times.** Per-site vs. office drive-time comparison with a live Δ
  (green when closer than the office, crimson when farther). Entered by hand in
  this build — see [Production gaps](#production-gaps).
- **Persistence.** The full state autosaves to `localStorage`. Export downloads
  it as `site-selection-data.json`; Import restores from such a file; Reset data
  restores the seed sample.

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

## Project structure

```
src/
  main.tsx              # entry
  App.tsx               # layout: header, nav, three columns, overlays
  store.tsx             # AppProvider — state, derived scoring, all actions
  types.ts              # domain model
  data/
    factors.ts          # the five weighting factors + defaults + icons
    seed.ts             # sample cities (Houston, San Ramon, San Diego, LA)
  lib/
    scoring.ts          # normalize / composite / scoreCity / scoreColor
    storage.ts          # load / save / export / import
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

1. **Drive times & distances** are entered by hand. Replace with a
   routing/distance-matrix API (Google Distance Matrix, Mapbox Matrix) keyed off
   the office and each site/reference lat-lng.
2. **Geocoding** typed addresses → coordinates (replace, or complement,
   click-to-place).
3. **Backend persistence** + multi-user projects/sharing (replace
   `localStorage`/JSON).
4. Marker **drag-to-reposition**, undo, and validation.
5. Editable **factor scores** for user-added sites (currently seeded neutral 70).

## Attribution

Map tiles © OpenStreetMap contributors. The OpenStreetMap attribution control
must be kept. For production, consider a commercial tile provider (Mapbox,
Google) with a styled basemap and an API key.
