# Accounts & sync (plan)

You asked to tie Profile, favourites, and targets to an **account**, while keeping **local-only** as an option — without building username/password auth yourself. That is doable.

## Recommendation: do **not** use Home Assistant as login

HA has users for its own UI, but it is **not** a general OAuth provider for third-party PWAs. “Sign in with Home Assistant” would mean a custom integration and long-lived tokens — high effort, little benefit vs Google.

## Recommended stack: **Supabase Auth + Google**

| Piece | Role |
|--------|------|
| **Supabase** (free tier) | Google OAuth, optional email magic link later |
| **`profiles` table** | age, weight, goals, `use_cloud_sync` flag |
| **`user_prefs` JSON** | favourites, nutrition targets, period stats cache |
| **Grocy** | Stays **one household backend** (shared API key on nginx) |

Flow:

1. First open → “Continuar só neste dispositivo” (localStorage, current behaviour).
2. Optional → “Entrar com Google” → Supabase session.
3. On sign-in, merge local prefs **up** to cloud; on other devices, pull **down**.
4. Settings → “Sair” / “Apagar dados na cloud”.

No passwords to hash, no reset flows, no email verification unless you want it later.

**Alternatives:** Firebase Auth (same idea), Clerk (paid, very polished). Avoid rolling your own JWT + bcrypt.

## What syncs vs what stays in Grocy

| Data | Where |
|------|--------|
| Recipes, stock, shopping list, meal log | **Grocy** (unchanged) |
| Favourites, nutrition targets, body profile, “last seen” UI state | **Supabase** (per user) |

Multi-user Grocy per family member is a different (much bigger) project. For a household, shared Grocy + per-person app prefs is the sweet spot.

## Effort (realistic)

| Phase | Work |
|-------|------|
| **1** | Supabase project, Google provider, login button, session in PWA |
| **2** | Migrate `useFavourites`, `useNutritionTargets`, `useUserProfile` to read/write Supabase when logged in |
| **3** | Conflict: last-write-wins or “cloud wins on login” |
| **4** (optional) | Edge function for server-side secrets — only if you stop embedding Grocy key in nginx |

Roughly **2–4 days** of focused work for phases 1–2; not a rewrite of the app.

## Can it be done?

**Yes.** Google sign-in via Supabase is the standard way to avoid “auth sucks.” Local-only remains the default for privacy and offline use.

## Will it blow your Supabase limit?

**Very unlikely** for Nourish alone, especially if you reuse your **existing project** instead of creating a second free project.

| Resource | Nourish usage (1 user, household) | Free tier (typical) |
|----------|-----------------------------------|---------------------|
| **Database** | A few KB–MB (`profiles`, JSON prefs) | 500 MB+ |
| **Auth MAU** | 1–3 people if family signs in | 50k MAU |
| **API requests** | Sync on login + occasional saves | Generous for personal apps |
| **Egress** | Tiny JSON blobs | Usually not an issue |

**Recommendation:** add tables `nourish_profiles` / `nourish_prefs` in the **same Supabase project** as your other app (separate table names). You stay on one project quota; no extra “project slot.”

**What would cost money:** second project you don’t need, storing images in Supabase Storage, heavy Edge Function traffic, or many real users.

**What stays free on Grocy/nginx:** recipes, stock, shopping list, meal log — unchanged.

Next step when you want it: enable Google provider in your existing project, add `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` to `.env`, implement `useAuth()` + sync hooks (see `docs/roadmap.md` phase 4).
