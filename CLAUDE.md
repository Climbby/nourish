# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Nourish** — a mobile-first meal tracker PWA built on top of Grocy as its backend/database. The custom UI handles meal browsing, pantry (Despensa) tracking, recipe display, meal logging, and creation while Grocy handles all persistence via REST API.

## Commands

```bash
npm run dev       # Start Vite dev server with HMR (proxies /api → Grocy)
npm run build     # Type-check (tsc) then bundle to dist/
npm run preview   # Serve the production build locally
npm test          # Run Vitest unit tests
```

Copy `.env.example` to `.env` and fill in `GROCY_API_KEY`, `GROCY_HOST`, and Grocy entity IDs before running `npm run dev`.

## Architecture

### Stack
- **React 18 + TypeScript** via Vite 5
- **React Router v6** — routes: `/`, `/add`, `/meal/:id`, `/meal/:id/edit`, `/favourites`, `/history`, `/add-product`
- **Tailwind CSS 3** — mobile-first, single-column container capped at `max-w-sm`
- **vite-plugin-pwa** — offline shell + image caching
- **Grocy** — sole backend; all data lives there (host configured via `GROCY_HOST`)

### Code Layout
```
src/
  api/grocy.ts           # All Grocy API calls via apiFetch<T>() wrapper
  config/grocy.ts        # Env-based Grocy entity IDs (group, location, unit)
  types/grocy.ts         # TypeScript interfaces
  utils/
    parseDescription.ts  # Decode recipe.description sections
    buildDescription.ts  # Encode form data into description
    stripHtml.ts         # HTML-stripping utility
  hooks/useFavourites.ts # localStorage-backed favourites
  pages/                 # Route-level components
  components/            # Reusable UI (MealCard, BottomNav, PhotoField, …)
  main.tsx               # App entry point
  App.tsx                # Router + layout shell
```

### Grocy API Integration

The `/api` path prefix is proxied to Grocy in both environments:
- **Dev:** `vite.config.ts` proxies `/api/*` → `GROCY_HOST` with the API key injected as a request header
- **Prod:** `nginx.conf` does the same proxy (via `envsubst` on `GROCY_HOST` / `GROCY_API_KEY`), serving `dist/` as static files

Grocy endpoints used:
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/objects/recipes` | List all recipes |
| GET/PUT/DELETE | `/api/objects/recipes/{id}` | Single recipe CRUD |
| GET | `/api/objects/recipes_pos` | Recipe ingredients (filter by `recipe_id`) |
| GET/POST/PUT | `/api/objects/products` | Products |
| GET | `/api/objects/quantity_units` | Unit labels |
| GET/POST/DELETE | `/api/objects/meal_plan` | Meal history |
| GET | `/api/objects/stock_log` | Stock consumption analytics |
| GET | `/api/stock` | Current stock levels |
| POST | `/api/stock/products/{id}/add\|consume` | Adjust stock |
| GET/POST | `/api/objects/shopping_list` | Shopping list |
| PUT | `/api/files/recipepictures/{filename}` | Upload recipe photo |
| PUT | `/api/files/productpictures/{filename}` | Upload product photo |

### Description-as-storage Pattern

Grocy's `Recipe.description` field stores structured data the schema doesn't natively support:

```
[Ingredientes]
Atum|1.50
Esparguete|0.80

[Passos]
step 1

[Nutricao]
calories:450
protein:30
carbs:60
fat:12

[Preco]
2.30

[Categoria]
Completa

[Porcoes]
3
```

`parseDescription` / `buildDescription` handle encode/decode. Portions are decremented on meal log (with rollback on failure) and incremented via "Preparar refeição".

Pantry products store buy amount in `Product.description` as `[BuyAmount]\n6`.

## Automations

Configured in `.claude/` — do not recreate these:
- **Hook** (`settings.json`): runs `tsc --noEmit` automatically after every file edit
- **Skill** `/deploy`: builds and SCPs `dist/` to the Proxmox LXC, then reloads nginx
- **Agent** `mobile-ui-reviewer`: reviews components for mobile UX, safe-area, and Tailwind quality

## Deployment Target

Production: static `dist/` served by Nginx inside a Proxmox LXC, exposed externally via Cloudflare tunnel (CT105). The Grocy API key and host are injected into nginx via environment variables — intentional for a single-user personal app.
