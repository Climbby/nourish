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
node --test homelab/*.test.mjs   # Homelab scripts — plain node:test, excluded from Vitest
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
Atum|1.50|80
Esparguete|0.80|250

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

[Tempo]
25

[Notas]
Menos sal da próxima.

[Origem]
restaurante

[Local]
Cantina do ISCTE

[Coords]
40.114,-8.499
```

`parseDescription` / `buildDescription` handle encode/decode. Portions are decremented on meal log (with rollback on failure) and incremented via "Preparar refeição".

`buildDescription` takes a single `BuildDescriptionInput` options object — not positional args.

**Ingredient lines** are `Nome`, `Nome|preco`, or `Nome|preco|gramas` (price may be blank: `Nome||gramas`). The 3-field form is only read when both trailing fields are numeric, so names containing a literal `|` still parse the legacy way. Trailing `|i` keeps the ingredient on the recipe but skips it for meal € **and** derived nutrition (quantity not required).

**`[Tempo]`** is cook time in minutes — an estimate to be replaced by the real measured time. **`[Notas]`** is free text that accumulates as a recipe gets repeated.

**`[Origem]`** is `supermercado` (home cooking) or `restaurante` (eat-out). **`[Local]`** is the restaurant name for eat-out meals — that is the display identity on cards, detail, and History (not reverse-geocoded locality). **`[Coords]`** is optional GPS used only to sort Fora meals by distance; it is not shown in the UI.

### Product nutrition

Pantry products store buy amount in `Product.description` as `[BuyAmount]\n6`, optional cooking alias and per-unit weight, plus per-100 g macros:

```
[BuyAmount]
1

[NomeCurto]
Atum

[Generico]
Cogumelos

[UnitGrams]
120

[Nutricao100]
calories:350
protein:12
carbs:70
fat:1.5
fibre:3
source:rotulo
```

`[NomeCurto]` is the cooking/search name used when picking ingredients (e.g. `Atum` for a long receipt name). `[Generico]` is the Despensa family label that groups variants (e.g. several mushroom SKUs under `Cogumelos`) — distinct from NomeCurto. `[UnitGrams]` is grams per stock unit so meal forms can enter counts (`2` latas) and resolve grams + € from Despensa price/`BuyAmount`. Legacy `[DespensaCat]` may still exist in old descriptions but is no longer shown or written from the UI.

`source` is `rotulo` (packaging label), `insa` (Tabela da Composição de Alimentos, INSA), or `manual` — descending order of trust. See `src/utils/productNutrition.ts`.

Recipe nutrition is **derived** from ingredient grams × product macros (`deriveRecipeNutrition` + `makeProductMacroLookup`), falling back to the hand-entered `[Nutricao]` block only while the derivation is incomplete. Name matching is exact (accent/case-insensitive) on product name **and** `NomeCurto` — a fuzzy match would silently produce plausible but wrong numbers.

Nutrition labels can be read from a photo (camera or gallery) via `src/features/nutrition/extractNutritionLabel.ts`, which guards against the model reading the kJ figure or the per-portion column.

## Automations

Configured in `.claude/` — do not recreate these:
- **Hook** (`settings.json`): runs `tsc --noEmit` automatically after every file edit
- **Skill** `/deploy`: builds and SCPs `dist/` to the Proxmox LXC, then reloads nginx
- **Agent** `mobile-ui-reviewer`: reviews components for mobile UX, safe-area, and Tailwind quality

## Deployment Target

After finishing user-visible work, **commit locally and deploy** (do not wait to be asked). Do not `git push` unless asked.

Production: static `dist/` served by Nginx from `/var/www/html` on **CT117 (`nourish`, 192.168.1.27)**, exposed externally via the Cloudflare tunnel running in CT105. SSH as root with `~/.ssh/pve_ed25519`; the Proxmox host is `pve` (192.168.1.3).

The Grocy API key, Grocy host, and OpenRouter key are injected into `nginx.conf` via `envsubst` at deploy time — intentional for a single-user personal app. All three must be present in `.env` or the rendered config will silently blank them.
