# Meal Tracker - Project Notes

## Concept
A personal meal rotation system to solve decision fatigue around food. Francisco doesn't have a mental library of meals and doesn't know how to cook most things. The goal is a system that:
- Holds a library of meals with photos, recipes, and ingredient prices
- Suggests what to eat next (rotation-based, not AI for now)
- Generates shopping lists automatically from planned meals
- Tracks meal costs over time
- Is extremely low friction to use

Grocy is the backend/database. A custom web app is the UI layer on top of it.

## What's in Grocy (http://192.168.1.61:9192)
- **7 recipes** with descriptions/cooking instructions:
  1. Pizza do frigorifico
  2. Frango do supermercado
  3. Pao com atum e ovo (ingredients: pao, atum em lata, 2 ovos)
  4. Nuggets de frango (air fryer)
  5. Febras com arroz de ervilha (ingredients: febras, arroz, ervilhas)
  6. Esparguete com carne picada (ingredients: esparguete, carne picada, molho de tomate)
  7. Lasanha do supermercado
- **13 products** grouped into: Congelados e Frigorifico, Mercearia, Carnes e Peixe, Frescos
- Grocy API key: AHbheQDTYILo0wwPnOkzutaj3tme8QthnzP6Odgs7G0qaagsIc

## Custom App Plan
A mobile-first web app (hosted as a new LXC on Proxmox) with 3 screens:

1. **Home** — grid of meal cards with photo, name, price
2. **Add Meal** — photo upload, meal name (required), optional price per ingredient, optional recipe steps. Saves to Grocy via API.
3. **Meal Detail** — large photo, recipe steps, ingredient list with prices

Stack: React or plain HTML/JS + Tailwind, talking to Grocy API directly.

## UI Design
Designed 3 screens in Google Stitch (project ID: 9451681119267847732):
- Design System: asset-stub-assets-b14a3a76578e4749b1b8c4c06a396b03-1779477345977
- Home - Nourish Tracker: 57fcf2e45fab474e9440bfb6abbd3056
- Add New Meal: 7be5e3a94e7e4f58bee33fb609d1416a
- Meal Details: af4fda9963cc4955a3442020a65613d0

Stitch MCP server added to Claude Code user config — restart Claude Code to activate it, then pull screens directly.

## Next Steps
1. Pull Stitch designs via MCP after Claude Code restart
2. Build the web app from the designs
3. Deploy as a new LXC on Proxmox
4. Expose via Cloudflare tunnel for mobile access outside home
