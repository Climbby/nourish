# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Nourish** — a mobile-first meal tracker web app built on top of Grocy as its backend/database. The custom UI handles meal browsing, recipe display, and meal creation while Grocy handles all persistence via REST API.

## Commands

```bash
npm run dev       # Start Vite dev server with HMR (proxies /api → Grocy)
npm run build     # Type-check (tsc) then bundle to dist/
npm run preview   # Serve the production build locally
```

No test suite exists in this project.

Copy `.env.example` to `.env` and fill in your Grocy API key before running `npm run dev`.

## Architecture

### Stack
- **React 18 + TypeScript** via Vite 5
- **React Router v6** — three routes: `/` (Home), `/add` (AddMeal), `/meal/:id` (MealDetail)
- **Tailwind CSS 3** — mobile-first, single-column container capped at `max-w-sm`
- **Grocy** (http://192.168.1.61:9192) — sole backend; all data lives there

### Code Layout
```
src/
  api/grocy.ts        # All Grocy API calls via apiFetch<T>() wrapper
  types/grocy.ts      # TypeScript interfaces: Recipe, RecipeIngredient, Product, QuantityUnit
  utils/stripHtml.ts  # Shared HTML-stripping utility (used by MealCard + MealDetail)
  pages/              # Route-level components (Home, AddMeal, MealDetail)
  components/         # Reusable UI (MealCard, BottomNav, Spinner)
  main.tsx            # App entry point
  App.tsx             # Router + layout shell
```

### Grocy API Integration

The `/api` path prefix is proxied to Grocy in both environments:
- **Dev:** `vite.config.ts` proxies `/api/*` → `http://192.168.1.61:9192` with the API key injected as a request header
- **Prod:** `nginx.conf` does the same proxy, serving `dist/` as static files

Grocy endpoints used:
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/objects/recipes` | List all recipes |
| GET | `/api/objects/recipes/{id}` | Single recipe |
| GET | `/api/objects/recipes_pos` | Recipe ingredients (filter by `recipe_id`) |
| GET | `/api/objects/products` | All products |
| GET | `/api/objects/quantity_units` | Unit labels |
| POST | `/api/objects/recipes` | Create recipe |
| PUT | `/api/files/recipepictures/{filename}` | Upload photo |

### Description-as-storage Pattern

Grocy's `Recipe.description` field is used to store structured data that Grocy's schema doesn't natively support. The app encodes ingredients and steps as sections within the description string:

```
[Ingredientes]
ingredient line 1
ingredient line 2

[Passos]
step 1
step 2
```

`MealDetail.tsx` parses this format at render time. When creating a recipe (`AddMeal.tsx`), the app serializes the form fields back into this format before POSTing to Grocy.

## Automations

Configured in `.claude/` — do not recreate these:
- **Hook** (`settings.json`): runs `tsc --noEmit` automatically after every file edit
- **Skill** `/deploy`: builds and SCPs `dist/` to the Proxmox LXC, then reloads nginx
- **Agent** `mobile-ui-reviewer`: reviews components for mobile UX, safe-area, and Tailwind quality

## Deployment Target

Production: static `dist/` served by Nginx inside a Proxmox LXC, exposed externally via Cloudflare tunnel (CT105). The Grocy API key is embedded in the nginx proxy config — this is intentional for a single-user personal app.
