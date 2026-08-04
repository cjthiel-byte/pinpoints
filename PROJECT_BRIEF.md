# Pinpoints — Project Brief

## Overview

A private web application for tracking places visited around the world. Features an interactive 3D globe with progressive zoom detail — users can click countries when zoomed out, then drill into first-level subdivisions (states, provinces, prefectures, etc.), with full county-level detail for the United States.

Named "Pinpoints" for the classic act of putting a pin on the map for each place you've been.

## Target Users

- Initial users: Chase Thiel and his wife
- Growth target: Family and friends (up to ~100 users maximum)
- **Not intended for mass audience.** Design decisions should optimize for personal use and a small trusted community, not scale.

## Core Features (MVP)

### The Globe

- Interactive 3D globe using **Cesium.js**
- Smooth zoom from world view down to county level (US only)
- Rotate, pan, and zoom controls (mouse + touch)
- Countries render as colored polygons when zoomed out
- Zooming in progressively reveals subdivisions
- Visited locations show a distinct color per user

### Tiered Selection (Global)

Progressive geographic drill-down as user zooms in:

**World zoom (out):** Click a country to toggle "visited"

**Country zoom (in):** Click a first-level subdivision to toggle "visited"

Terminology adapts to the country being viewed:
- USA → "States"
- Canada → "Provinces/Territories"
- UK → "Countries" (England, Scotland, Wales, Northern Ireland)
- Japan → "Prefectures"
- Germany → "Bundesländer" (States)
- France → "Regions"
- Australia → "States/Territories"
- Mexico → "States"
- Italy → "Regions"
- Spain → "Autonomous Communities"
- All other countries → generic "Regions" as default, override where data is available

**State zoom (US only):** Click a county to toggle "visited"

**Important scope note:** Second-level (county-equivalent) subdivisions are **US-only for MVP**. All other countries stop at level 1 (states/provinces/etc.). This significantly reduces data complexity while covering the primary use case (US-based user with domestic travel).

### Terminology Display Layer

The app should have a JSON config that maps country codes to their subdivision terms:

```json
{
  "USA": {
    "level1": { "name": "State", "plural": "States" },
    "level2": { "name": "County", "plural": "Counties" }
  },
  "CAN": {
    "level1": { "name": "Province", "plural": "Provinces" }
  },
  "JPN": {
    "level1": { "name": "Prefecture", "plural": "Prefectures" }
  },
  "GBR": {
    "level1": { "name": "Country", "plural": "Countries" }
  },
  "DEU": {
    "level1": { "name": "State", "plural": "Bundesländer" }
  },
  "FRA": {
    "level1": { "name": "Region", "plural": "Regions" }
  },
  "AUS": {
    "level1": { "name": "State/Territory", "plural": "States/Territories" }
  },
  "MEX": {
    "level1": { "name": "State", "plural": "States" }
  },
  "ITA": {
    "level1": { "name": "Region", "plural": "Regions" }
  },
  "ESP": {
    "level1": { "name": "Autonomous Community", "plural": "Autonomous Communities" }
  }
}
```

Countries not in the config default to `"Region"` / `"Regions"` as generic labels.

The UI dynamically uses these labels based on which country the user is looking at. Example: "You've visited 12 Prefectures in Japan" (not "12 Regions in Japan").

### User Accounts

- **Email + Google OAuth** sign-up via Firebase Auth
- Simple signup: email/password OR Google login
- Each user has: userId, email, displayName, chosen color, joinDate
- User picks a color for their pins at signup (blue, pink, green, purple, orange, teal, red, etc.)
- No email verification required (low friction, small trusted user base)

### Per-Location Data

- Boolean: visited (yes/no)
- Optional: date visited (year is sufficient for MVP)
- Optional: short note (e.g., "Honeymoon", "Road trip 2023")

### Visualization Modes

- **My visits:** Shows only current user's visited locations
- **All users:** Shows an overlay where locations visited by multiple users appear in a blended color (e.g., if Chase = blue and wife = pink, both = purple)
- **Individual user:** Toggle to see a specific user's visits

### Stats Panel

Show for the current user:
- Total countries visited (out of ~195)
- Total US states visited (out of 50)
- Total US counties visited (out of ~3,143)
- Per-country subdivision counts where applicable (e.g., "12 of 47 Prefectures in Japan")
- Global % of countries visited
- Same stats aggregated for "all users combined"

### Not in Scope for MVP

- Photo uploads
- Public sharing / SEO pages
- Social features (comments, likes)
- Achievements system
- Second-level subdivisions for non-US countries
- Mobile app (responsive web is enough)
- Password reset UI (users can use Google OAuth if they forget)

### Future Considerations (Phase 2+)

- Photo attachments per location
- Trip planning (mark places you want to visit)
- Second-level subdivisions for select countries (Canada census divisions, UK counties, etc.)
- Achievements ("Visited every continent", "5 states in a road trip", etc.)
- Trip grouping (assign multiple locations to a named trip)
- Public sharing via URL

## Tech Stack

### Frontend
- **Framework:** Astro + TypeScript
- **Styling:** Tailwind CSS
- **3D Globe:** Cesium.js (open source)
- **State management:** React or Vue islands within Astro as needed

### Backend / Data
- **Auth:** Firebase Authentication (Google OAuth + email/password)
- **Database:** Firebase Firestore
- **Hosting:** Cloudflare Pages (free tier)
- **URL:** `pinpoints.pages.dev` initially (can move to custom domain later)

### Geographic Data

All public-domain, downloaded once and served as GeoJSON from `/public/geo/`:

- **Countries:** Natural Earth (naturalearthdata.com) — public domain
- **First-level subdivisions (global):** Natural Earth Admin 1 (states/provinces/etc. for every country) — public domain
- **US states:** US Census TIGER/Line shapefiles — public domain
- **US counties:** US Census TIGER/Line shapefiles — public domain

Convert to GeoJSON format (or vector tiles for US counties due to size) before deployment.

## Data Model (Firestore)

```
users/
  {userId}/
    email: string
    displayName: string
    color: string (hex code, e.g., "#3B82F6")
    joinedAt: timestamp

visits/
  {visitId}/
    userId: string
    countryCode: string       // ISO Alpha-3, e.g., "USA", "JPN"
    locationType: "country" | "level1" | "level2"
    locationId: string
      // country: ISO Alpha-3 (e.g., "USA", "JPN")
      // level1: {country}-{code} (e.g., "USA-CA", "JPN-13")
      // level2: {country}-{level1}-{code} (e.g., "USA-CA-Los_Angeles")
      //   NOTE: Level 2 is US-only for MVP
    displayName: string       // Human-readable, e.g., "California", "Shibuya", "Allegheny County"
    dateVisited: string (optional, e.g., "2023")
    notes: string (optional)
    createdAt: timestamp
```

### Firestore Security Rules

- Users can only write to their own `users/{userId}` document
- Users can only create/update/delete visits where `userId` matches their auth ID
- Anyone authenticated can read all users and all visits (needed for "all users" view)
- Enforce that `locationType: "level2"` visits must have `countryCode: "USA"` (server-side rule)

## Auth Implementation

- Firebase Auth with Google OAuth (primary) + email/password (backup)
- On signup, prompt user to pick their pin color from a preset palette (~8 colors)
- Store user profile in `users/{userId}` collection
- No email verification required
- Session persistence handled by Firebase Auth

## Development Sprints

1. **Sprint 1:** Astro project setup, Firebase Auth, deploy to Cloudflare Pages, verify hello world deploy pipeline
2. **Sprint 2:** Cesium globe integrated, countries GeoJSON loaded, basic click-to-highlight (no persistence yet)
3. **Sprint 3:** Firestore integration, persist visited countries per user, load on login
4. **Sprint 4:** Add first-level subdivision (state/province/prefecture) layer using Natural Earth Admin 1 data. Click-to-toggle.
5. **Sprint 5:** Design and implement terminology system for subdivision labels. Wire into UI.
6. **Sprint 6:** Add US counties layer with click handling (vector tiles for performance). Only loads when zoomed into US.
7. **Sprint 7:** User color system, "all users" overlay view with color blending
8. **Sprint 8:** Stats panel with country-specific terminology
9. **Sprint 9:** UI polish, transitions, mobile responsiveness testing
10. **Sprint 10:** Testing, bug fixes, share with wife for beta feedback

Estimated timeline: 8-12 weekends of casual work.

## Design Direction

- **Feel:** Modern, minimal, focused on the globe. The map should be the star.
- **Palette:** Dark space-blue background so the globe pops
- **UI:** Overlay panels for auth, stats, user switcher — should be unobtrusive
- **Interactions:** Smooth transitions, responsive to touch and mouse
- **Inspiration:** Google Earth for the globe feel; simple travel journal apps for tracking UI

## Cost Constraints

- **Must remain free forever for users**
- **Free tier services only**
- Firebase free tier: 50k reads/day, 20k writes/day, 1GB storage
- Cloudflare Pages: unlimited bandwidth, 500 builds/month
- With ~100 users, this stays well under free tier limits

## Success Criteria

- Chase and his wife can each sign up and mark locations within 2 minutes
- Globe loads in under 3 seconds on typical connection
- Runs smoothly at 30-60fps on modern devices
- Data persists reliably across sessions
- Beautiful enough that we actually want to use it regularly

## Deployment Info

- **Hosting:** Cloudflare Pages
- **Initial URL:** `pinpoints.pages.dev`
- **Repo:** GitHub (public or private — Chase's choice)
- **CI/CD:** Cloudflare Pages auto-deploys on push to main branch
- **Firebase project name:** `pinpoints-app` (or similar)

## Known Technical Challenges

1. **US county data is large** — over 3,000 counties. Need vector tiles or LOD (level of detail) rendering. Only load when user zooms into US.
2. **Cesium.js has a learning curve** — plan for 1-2 sprints to get comfortable with it
3. **Terminology display logic** — needs consistent handling across all UI components
4. **Progressive data loading** — don't load all geo data at once; load per-country as user zooms in
5. **Mobile touch controls on 3D globe** — needs testing and possibly custom handling
6. **Level of detail transitions** — smooth switching between country/state/county visualization based on zoom level

## Getting Started for Claude Code

When you (Claude Code) read this document, please:

1. Confirm you understand the project scope
2. Ask any clarifying questions before writing code
3. Suggest an initial file structure for the Astro project
4. Start with Sprint 1: project setup + Firebase Auth + Cloudflare Pages deployment
5. After each sprint, pause and confirm before moving to the next

Prefer small, testable commits over large sweeping changes. Prioritize getting a working deployed version early, then iterating.

## Reference Materials

- Cesium.js docs: https://cesium.com/learn/cesiumjs-learn/
- Firebase Auth docs: https://firebase.google.com/docs/auth
- Astro docs: https://docs.astro.build
- Natural Earth data: https://www.naturalearthdata.com
- US Census TIGER files: https://www.census.gov/geographies/mapping-files.html
- Cloudflare Pages docs: https://developers.cloudflare.com/pages/
- Tailwind CSS docs: https://tailwindcss.com/docs

## Prerequisites Checklist Before Starting

Before running Sprint 1, make sure these are set up:

- [ ] GitHub repo created (public or private)
- [ ] Firebase project created at console.firebase.google.com
- [ ] Firebase: Google OAuth and Email/Password providers enabled
- [ ] Firebase: Firestore database created (in test mode initially)
- [ ] Cloudflare account created and linked to GitHub
- [ ] Node.js installed locally (v18 or later)
- [ ] Local development environment ready (VS Code recommended)
