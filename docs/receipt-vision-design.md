# Talão (receipt) detection — vision-LLM redesign

Status: **DRAFT for sign-off** (2026-06-23). No code until approved.

## Goal

Read an Auchan/Continente talão from a phone photo and turn it into clean line
items (name, qty, price) that flow into the existing **review → commit to Grocy**
screen with minimal manual fixing. Accuracy is the priority; the parser must cope
with faint thermal print on tall, thin receipts.

## Why the current pipeline falls short

```
photo → tesseract.js (por) → flat text → regex parser (auchan/continente) → ReceiptLine[]
```

Tesseract only does pixels→characters with **no layout or domain understanding**.
On faint, skewed thermal print it produces garbled text, and the regex then has to
guess which token is a product vs a price vs a tax/loyalty line. It has no context
to recover from errors. This is the weak link.

## Approach (locked)

Replace the OCR+regex step with the **vision LLM already wired in `src/api/ai.ts`**
(OpenRouter via the `/ai/v1/chat/completions` proxy). One call does OCR + layout +
Portuguese-retail reasoning and returns structured JSON. Downstream
(`buildReviewLines` → `matchProduct` → `commitReceipt`) is **unchanged** because we
keep returning `ReceiptLine[]`.

```
photo → downscale (canvas) → vision LLM → { store, date, total, lines[] } → ReceiptLine[]
       → buildReviewLines → review screen → commit to Grocy   (unchanged)
```

Tesseract stays in the tree as an **offline/private fallback** (manual toggle), but
vision is the default path.

## Extraction contract

New `src/features/receipt/extractReceiptVision.ts`:

```ts
async function extractReceiptVision(image: File): Promise<{
  store: 'auchan' | 'continente' | 'other' | null
  purchasedDate: string | null   // YYYY-MM-DD from "Data Emissao"
  total: number | null           // for cross-check, not committed
  lines: ReceiptLine[]           // { raw, name, qty, unitPrice, lineTotal }
}>
```

### System prompt (DRAFT — co-author before building)

> És um leitor de talões de supermercado português. Recebes a foto de um talão
> (possivelmente com texto fino/desbotado e ligeiramente inclinado). Extrai **apenas
> as linhas de produtos comprados**. Ignora cabeçalho, NIF, morada, IVA/impostos,
> totais, troco, QR code, cartão/pontos de fidelização e rodapé.
>
> Para cada produto devolve: nome (como impresso, sem códigos), quantidade,
> preço unitário e preço total da linha (EUR, ponto decimal). Para linhas a peso
> (kg) usa o peso como quantidade. Devolve também a loja, a data da compra
> (Data Emissão) e o total do talão.
>
> Devolve **APENAS** JSON válido:
> `{ "store": "auchan|continente|other|null", "purchasedDate": "YYYY-MM-DD|null", "total": number|null, "lines": [ { "name": string, "qty": number, "unitPrice": number, "lineTotal": number } ] }`

Validation after the call: drop lines with empty name or `lineTotal <= 0`; if
`sum(lineTotal)` deviates from `total` by more than a small tolerance, surface a
gentle "confere o talão" note in review (don't block).

## Capture UX (the other half of accuracy)

Update `ReceiptScanPage` capture step with inline guidance + a sample:

- Shoot **straight overhead (perpendicular)**, not at an angle.
- **Dark, matte, non-reflective** background; even, diffuse light, no harsh shadow.
- **Fill the frame**; tap to focus on the text.
- Long receipt → option to add a **second overlapping photo** (top half / bottom
  half). The LLM merges; we de-dupe overlapping lines by `(name,lineTotal)`.

Before upload, **downscale** on a canvas to ~2000 px long edge (keeps thin-text
legibility while controlling image tokens/latency/cost).

## Privacy

Current copy promises *"a imagem não sai do dispositivo"* — false once we use a
cloud model. Change to: *"A foto é enviada de forma segura para leitura automática."*
Add an **opt-in toggle** (default ON) that, when OFF, uses the on-device tesseract
fallback. The proxy already injects the key server-side; the phone never holds it.

## Model & cost

Start with `VITE_OPENROUTER_VISION_MODEL` (default `google/gemini-2.5-flash`) —
strong, cheap, already configured. If accuracy on real receipts isn't enough, bump
to a stronger vision model via the same env var (no code change).

## Files touched

| File | Change |
|------|--------|
| `src/features/receipt/extractReceiptVision.ts` | **new** — vision call + JSON→`ReceiptLine[]` |
| `src/features/receipt/ReceiptScanPage.tsx` | use vision path; capture guidance; opt-in toggle; multi-shot |
| `src/api/ai.ts` | small shared helper for the vision request (reuse existing pattern) |
| `src/features/receipt/useReceiptOcr.ts` | kept as offline fallback |
| `src/features/receipt/extractReceiptVision.test.ts` | **new** — schema parsing/validation unit tests |

`types.ts`, `parsers/*`, `buildReviewLines`, `matchProduct`, `commitReceipt`
unchanged.

## Open questions

1. **Multi-shot now or later?** Proposal: ship single-shot first; add the second
   photo only if one shot underperforms on a long talão.
2. **QR cross-check?** PT fiscal QR (Portaria 195/2020) carries document total +
   date + ATCUD + tax, **not** line items. Could later decode it to validate the
   total. Out of scope for v1 (will verify the field layout before building if we do).
3. **Tolerance** for the sum-vs-total mismatch warning (proposal: €0.05 or 2%).

## Verification plan

- Unit tests on JSON parsing/validation with sample model outputs.
- Manual run against today's Auchan talão photo + a Continente one; check line
  count, names, prices, and that review→commit still works.
