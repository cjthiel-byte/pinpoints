# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project State

This repository is **pre-implementation**. It currently contains only `README.md` and `PROJECT_BRIEF.md` — no Astro project, no `package.json`, no source code exists yet. There are no build/lint/test commands to run because nothing has been scaffolded. Once the project is initialized, this file should be updated with real commands.

`PROJECT_BRIEF.md` is the authoritative spec for this project — read it in full before doing any work here. The summary below hits the points most relevant to writing code; the brief has full details (Firestore security rules, per-sprint breakdown, design direction, cost constraints, reference doc links).

## What Pinpoints Is

A private web app (Chase + wife, growing to ~100 trusted friends/family max — never a mass audience) for tracking visited places on an interactive 3D globe, with progressive drill-down: world → country → first-level subdivision (state/province/prefecture/etc.) → US county (US-only for MVP).

## Planned Tech Stack

- **Framework:** Astro + TypeScript, with React or Vue islands for interactive pieces
- **Styling:** Tailwind CSS
- **3D Globe:** Cesium.js
- **Auth:** Firebase Authentication (Google OAuth + email/password, no email verification)
- **Database:** Firebase Firestore
- **Hosting:** Cloudflare Pages, auto-deploy on push to `main`
- **Geo data:** Public-domain GeoJSON in `/public/geo/` (Natural Earth for countries/admin-1 subdivisions, US Census TIGER/Line for US states and counties). US county data is large — needs vector tiles or LOD, loaded only when zoomed into the US.

## Core Architecture Concepts

- **Progressive geo data loading**: never load all geo layers at once. Countries load globally; first-level subdivisions load per-country on zoom; US counties load only when zoomed into the US (vector tiles for size/perf).
- **Terminology display layer**: subdivision naming ("States" vs "Prefectures" vs "Bundesländer") is data-driven via a country-code-keyed JSON config, not hardcoded per-country UI. Unlisted countries default to generic "Region"/"Regions". This logic needs to be applied consistently everywhere subdivision names are shown.
- **Location ID scheme** (Firestore `visits` collection): `locationId` encodes the geographic hierarchy in the string itself — country: `USA`; level1: `USA-CA`; level2 (US-only): `USA-CA-Los_Angeles`. `locationType` (`"country" | "level1" | "level2"`) and `countryCode` are stored alongside for querying.
- **Multi-user visualization modes**: "My visits" (current user only), "All users" (color-blended overlay where overlapping visits mix each user's chosen color), and single "Individual user" view. This blending logic sits on top of the same visits data, not separate data models.
- **Firestore security model**: users write only to their own `users/{userId}` doc and only to visits where `userId` matches their auth ID; any authenticated user can read all users/visits (required for the "all users" view); `locationType: "level2"` must be server-rule-enforced as USA-only.

## Working Style Requested in the Brief

The brief explicitly asks Claude Code to, on first reading it: confirm understanding of scope, ask clarifying questions before writing code, propose an initial Astro file structure, then begin with Sprint 1 (project setup + Firebase Auth + Cloudflare Pages deploy) and pause for confirmation after each sprint rather than running through all 10 sprints unattended. Prefer small, testable commits over large sweeping changes; get a working deployed version early and iterate.
