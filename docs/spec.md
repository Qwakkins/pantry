# Pantry App — Build Spec v1

Oct 17, 2026 · @Steven

A low-cost personal web app that helps two people in separate kitchens cook through what they buy — especially the leftover half of one-off ingredients — while hitting protein goals and planning meal prep.

## 1. Goal and principles

**Headline goal: never waste the other half.** When a recipe needs a one-off ingredient (fish sauce, half a bunch of cilantro, a can of coconut milk), the app should already know what else to cook with the rest — ideally before you shop, not after it spoils.

Secondary goals: hit a daily or weekly protein target, plan a weekly meal prep, and keep a shared cookbook with your girlfriend. Primary user is you; cost target is $0–2/month.

Design principles:

1. **Plan-time over rescue-time.** Show what a recipe will leave behind when you pick it, and pair it with recipes that use the rest.
2. **The inventory is approximate, not exact.** Track presence plus a rough amount ("full", "about half", "low") for opened perishables; never pretend to know grams. Confidence decays over time.
3. **Updates are a side effect of things you already do.** Checking off the shopping list adds to the pantry; tapping "cooked this" subtracts. Photos and receipts are backup intake, not the main loop.
4. **Never silently change a list.** Show "probably have" instead of removing items. (Plan to Eat dropped its pantry feature because silent removals caused wrong shopping lists — [their write-up](https://learn.plantoeat.com/help/a-digital-pantry-inventory-does-it-really-help).)
5. **Your recipes first.** The engine searches the cookbook you two actually cook from, not millions of random recipes.
6. **One planning engine.** Leftover pairing, the unlock list, protein, meal prep and (later) budget all score the same recipe set; new goals are new weights, not new systems.
7. **Cheap by design.** Free hosting tiers, a small AI model, no stored photos, a hard spend cap.

## 2. Users and scope

Two users in separate kitchens about 90 minutes apart, sharing one cookbook.

|  | You | Girlfriend |
| --- | --- | --- |
| Pantry | Own pantry, fridge, freezer | Own pantry, fridge, freezer |
| Cookbook | Shared library; either can add | Shared library; either can add |
| Ratings, notes, status | Personal | Personal |
| Protein target, dietary settings | Personal | Personal |
| Shopping list, unlock list, leftovers | Computed from your pantry | Computed from hers |
| "Sent to you" inbox | Yes | Yes |

Platform: an installable web app (PWA) on both phones — iPhone via Safari "Add to Home Screen", Android via Chrome "Install app". No App Store.

**In scope for v1 (phases 0–2):** cookbook with URL and paste import, canonical ingredients with a one-level hierarchy, manual tick-list pantry with rough amounts, leftover labels at pick time, pairing (including "freeze the rest"), near-match by missing-item count, unlock list, "cooked this" deduction.

**Deferred to v2 (phases 3–5):** fridge and receipt photo intake, quick-text updates, FoodKeeper import and confidence decay, daily digest and push notifications, protein targets, meal prep planner, second account, inbox, collections. **Out of scope entirely:** food logging, exact quantities or grams, combined-pantry view, native apps, public sign-up, video import, store prices and deals (see Section 10), barcode lookups beyond Open Food Facts.

## 3. Phased roadmap

Six phases, each usable on its own. The headline "other half" feature lands in phase 2, right after the cookbook exists, because leftover prediction needs recipes and package sizes, not a photographed pantry. Richer pantry intake comes after it and makes it more accurate. The data model supports two users from phase 0 even though the second account arrives in phase 5.

0. **Foundations** — monorepo with a dependency-free `engine` package, PWA shell, Supabase project, magic-link sign-in with an email allowlist, row-level security with tests, canonical ingredient table with one-level hierarchy and synonyms, curated shelf-life table (\~15 categories), \~200 seeded ingredients with package sizes, AI proxy with per-user cap and cache.
   - Done when: you can sign in on your phone; "green onion", "scallions" and "spring onion" resolve to one ingredient and "green onion" does not resolve to "onion"; the RLS test passes.
1. **Cookbook** — import from URL (schema.org first, LLM fallback) or pasted text; ingredient lines parsed to quantity + unit + canonical ingredient + role (main / optional) + essential flag; steps stored; status (want to try / made it / on rotation); search by ingredient; per-user staples list; eval harness with mapping and role accuracy measured separately.
   - Done when: 30 of your real recipes are imported with ≥90% of lines mapped to the right ingredient and ≥75% with the right role, measured by the eval script.
2. **Never waste the other half** — manual pantry (tick-list by category, full / about half / low, simple expiry from the shelf-life table); shopping-list check-off adds, "cooked this" subtracts; leftover label (none / some / most) when you pick a recipe; pairing suggestions for the leftovers, with "freeze the rest" when the ingredient freezes well and an LLM stub when the cookbook has no partner; post-cook rescue list; near-match ("cook now", "1 away", "2 away"); the unlock list ("buy 2 things → 5 recipes"). Demo video and README ship here.
   - Done when: picking any recipe that uses a perishable one-off shows at least one follow-up from your cookbook, or a freeze/stub suggestion, that uses the rest.
3. **Pantry intake** — fridge photo, receipt photo, quick text ("bought spinach, eggs"); FoodKeeper import replacing the curated table; confidence that decays and resets on confirmation; freezer timelines; "use soon" list; daily digest via web push.
   - Done when: a weekly shop takes under two minutes to log, and the use-soon list matches what's actually in your fridge.
4. **Protein and meal prep** — LLM-estimated protein per serving at import; daily/weekly target; prep planner that runs the pairing engine in a loop over a virtual pantry; combined shopping list; prep-day mode with merged steps and timers; cooked portions enter inventory with their own shelf life.
   - Done when: you can plan a Sunday prep in under five minutes that hits your weekly protein target and leaves no perishable orphans.
5. **Second user** — her account and pantry; personal ratings, notes and status on shared recipes; "sent to you" inbox; per-person dietary settings and staples.
   - Done when: she installs it from a link and uses the cookbook without help.

## 4. Core logic

Everything rests on one canonical ingredient list; get that right first and every feature below is simple arithmetic over a few hundred recipes.

### 4.1 Canonical ingredients

- One row per ingredient ("green onion") with synonyms, category, default storage, shelf-life link, typical package size, perishable flag, freezes-well flag, and later protein per 100 g.
- One-level hierarchy via `parent_id`: "chicken thighs" and "chicken breast" are children of "chicken". Matching happens at the leaf; if the pantry has a sibling, the line counts as a substitute, while expiry and leftovers use the leaf.
- Resolving a raw line ("3 scallions, thinly sliced"): strip quantity, unit and prep words → exact synonym match (user synonyms first, then global) → head-noun token match → trigram fuzzy at ≥ 0.85 → LLM proposes a canonical name for one-tap confirm. Quantity and unit are context: "to taste" or "pinch" biases "pepper" to the spice. A `not_synonyms` list blocks known near-misses (coconut cream ≠ coconut milk).
- Confirmed mappings are saved as synonyms owned by the user who confirmed them, so one person's correction never changes the other's parses. Promote to global by review.
- Seed \~200 common ingredients up front with a curated shelf-life table; grow the list from real imports. FoodKeeper import and the full 400+ arrive in phase 3.

### 4.2 Ingredient roles

Each recipe line gets a role: **main** (counts toward cookability) or **optional** (garnish, "to serve"). Up to two main lines per recipe are flagged **essential**: missing one means the dish cannot be made regardless of what else you have. "Staple" is not a recipe-line role; each user keeps a personal staples list (salt, oil, spices, and "always have or always finish" items like milk, eggs and butter) that is applied at scoring time, so a shared recipe can be scored differently in each kitchen. Optional lines are excluded from cookability but included in leftover prediction and the shopping list, because garnish herbs are the most common orphan. The LLM proposes roles and essentials at import; you can correct them.

### 4.3 Match score (missing-item count)

```latex
\text{missing} = \#\{\text{main lines with no leaf, sibling or substitute in the pantry at confidence} \ge 0.7\}
```

- **Cook now:** missing = 0, every essential present, no main below confidence 0.7. If any main is between 0.3 and 0.7, show "probably — confirm cilantro" instead.
- **1 away / 2 away:** missing = 1 or 2 with the items listed. Any missing essential is shown as "needs X" and the recipe cannot be "cook now". A setting caps how far away a recipe may be and still appear (default 2).
- Ties within a band break on coverage ratio (mains present ÷ mains), then on urgency of pantry items used.
- Amount matters for mains: full counts 1.0, about half 0.7, low 0.3; staples ignore amount. A main at low shows as "check: chicken is low".
- Substitutes come from a global `substitutes` table (lime↔lemon, shallot↔onion, Greek yogurt↔sour cream) with a strength that lowers the line's contribution, not from per-recipe annotation.

### 4.4 Leftover prediction and pairing

- Check the pantry first. If the ingredient is already present in any amount, the recipe buys nothing and scores positive for using an existing leftover; no new leftover is predicted.
- Otherwise the leftover is a three-state label: **none**, **some**, **most**. When the recipe amount converts to the package unit, used ÷ package > 0.75 → none, 0.25–0.75 → some, < 0.25 → most. When it cannot convert (most produce lines), a perishable gets **some**; a non-perishable gets none. The subtraction is a tiebreaker, not the model.
- Package size comes from the ingredient's default, overridable per user, and confirmed at shopping-list check-off ("bunch or clamshell?").
- A leftover is an **orphan** if it is perishable (fridge life after opening ≤ 14 days), not on the user's staples list, and no accepted pairing or already-cookable cookbook recipe uses it. Staples never become orphans.
- Suggestions, in order: "freeze the rest" when the ingredient freezes well (tomato paste, ginger, bread, stock); then cookbook recipes ranked by the planning-engine score, which counts orphans used, items missing and orphans the pairing would itself create; then, if the cookbook has no partner, an LLM one-liner ("three things to do with half a bunch of cilantro") saved as a recipe stub you can promote. Show the top 1–3 at pick time and again after "cooked this".
- Urgency for a predicted leftover is its after-opening fridge life; for a pantry item it is days to `expires_min`.

### 4.5 Unlock list

- Candidates: the missing main ingredients of every 1-away and 2-away recipe, excluding anything already on the shopping list (shown separately as "already on your list").
- Greedy selection with one-step lookahead from day one, 1–3 items; no exhaustive search (one code path, fast on a phone at any cookbook size). Reference: [CookCLI's greedy coverage](https://cooklang.org/blog/14-greedy-coverage-blog/).
- Objective: recipes moved to cook now, then recipes moved to 1 away, so the list is useful while the cookbook is small ("buy soy sauce → 2 cook-now, 4 one-away").
- Penalize candidates by perishability × recipes you would realistically cook before they spoil (cap 2 per week), so a non-perishable that unlocks 5 recipes outranks a bunch of herbs that unlocks 5.
- When a recipe is 1 away only because of a "probably have" item, the row says "buy Y, confirm X".

### 4.6 Expiry and confidence

- Two separate quantities: `expires_on` answers "is it still good?"; `confidence` answers "do I still have it?". The spec previously blended them.
- `expires_min` / `expires_max` = purchase date + the shelf-life range for the storage location (FoodKeeper gives ranges such as 1–2 days for raw chicken). "Use soon" sorts by min; "probably still good" uses max. Opening switches to the after-opening range; `opened_on` is inferred from the first "cooked this" that uses the item, since nobody logs opening a jar. Moving to the freezer switches to the freezer range rather than pausing forever; `thawed_on` restarts a 1–2 day clock (phase 3).
- Confidence starts at 1.0 for check-off and text, lower for photo intake; it decays with time since last confirmation and with each cook event that used the item, and resets when confirmed (check-off, photo, or "still have it"). Staples floor at "probably". Items below 0.3 show as "probably gone"; items between 0.3 and 0.7 show as "probably have" and never silently change a shopping list.

### 4.7 Planning engine

One function, `score(recipe, virtualPantry, goals)`, lives in the shared `engine` package and serves "Tonight", leftover pairing, unlock ranking and the prep planner. It runs in the browser for interactive screens and in an edge function for the daily digest. Dietary exclusions filter candidates before scoring; every term below is normalized to 0–1 before weighting:

```latex
\text{score} = w_1\,\text{cookability} + w_2\,\text{urgency used} + w_3\,\text{orphans used} + w_4\,\text{protein fit} + w_5\,\text{tag match} - w_6\,\text{items missing} - w_7\,\text{orphans created}
```

- Cookability is 1 for cook now, 0.6 for 1 away, 0.3 for 2 away, 0 otherwise; urgency used is 1 − (days left ÷ 14) summed over pantry items the recipe uses, capped at 1; orphan and missing counts are divided by the recipe's main-line count.
- The prep planner is pairing in a loop: pick the best-scoring recipe, add what it leaves behind to a virtual pantry, subtract what it uses, re-score, repeat 2–4 times. Shared ingredients are rewarded by the loop itself, so there is no separate set bonus.
- Protein per serving is estimated by the LLM at import and flagged `estimated` (phase 4); ingredient-level protein math waits until unit weights exist.
- Leave a slot for a future cost term (− w8 × estimated cost) so the budget planner (Section 10) plugs in without a rewrite.
- Weights live in a settings row so they can be tuned without a deploy.

## 5. Data model

Fifteen Postgres tables in the v1 migrations (phases 0–2) and nine more deferred to `docs/schema-later.md`. Pantry, lists, staples and settings belong to one user; recipes are household-shared unless marked private, and either user may edit a shared recipe.

| Table | Key fields | Owner / visibility |
| --- | --- | --- |
| `profiles` | id, display\_name | Self |
| `user_settings` | user\_id, max\_missing (default 2), score\_weights, dietary\_exclusions\[\], protein\_target\_g (phase 4), digest\_time (phase 3) | Self |
| `ingredients` | id, name, parent\_id, category, default\_storage, storage\_guideline\_id, package\_size + unit, perishable, freezes\_well, unit\_weight\_g, protein\_per\_100g, created\_by | Global; seed rows immutable, user-created rows editable by creator |
| `storage_guidelines` | id, name, category, fridge\_days\_min/max, pantry\_days, freezer\_days, after\_opening\_days, source (curated / foodkeeper), foodkeeper\_id, metric (days / weeks / months / indefinitely / not recommended). FoodKeeper is a 2018 CC0 snapshot of ~660 generic products with min/max ranges per timeline | Global |
| `ingredient_synonyms` | ingredient\_id, synonym, user\_id (null = global), source (seed / llm / user), confirmed\_at | Global rows read by all; user rows read and written by owner |
| `substitutes` | ingredient\_a, ingredient\_b, strength, symmetric | Global |
| `recipes` | id, owner\_id, updated\_by, visibility (shared / private), title, description, source\_type (url / paste / photo), source\_url, source\_hash, image\_url, servings, steps (JSON), tags\[\], prep\_minutes, total\_minutes, protein\_per\_serving, protein\_estimated, freezes\_well, model\_version, deleted\_at | Shared by default; any household user edits, owner deletes |
| `recipe_ingredients` | recipe\_id, position, section, raw\_text, ingredient\_id, quantity, quantity\_max, unit, unit\_raw, prep, role (main / optional), essential | Follows recipe via EXISTS policy |
| `recipe_user_meta` | recipe\_id, user\_id, rating, notes, status (want to try / made it / on rotation) | Per user |
| `user_staples` | user\_id, ingredient\_id, assumed\_present, out\_since | Self |
| `pantry_items` | id, user\_id, ingredient\_id, kind (raw / cooked), location (fridge / freezer / pantry), amount\_state (full / half / low), purchased\_on, opened\_on, frozen\_on, thawed\_on, expires\_min, expires\_max, confidence, last\_confirmed\_at, source (checkoff / text / photo / receipt), package\_override, source\_cook\_event\_id, note | Self only |
| `shopping_list_items` | id, user\_id, ingredient\_id, for\_recipe\_id, origin (manual / recipe / unlock / pairing), quantity\_note, probably\_have, added\_by, checked\_at | Self only |
| `cook_events` | user\_id, recipe\_id, cooked\_at, servings\_made, portions\_stored, deductions (JSON, for undo), note | Self only; drives pantry deductions and leftovers |
| `ai_calls` | user\_id, kind, input\_hash, model, tokens\_in, tokens\_out, cost\_cents, cached, created\_at | Self; written by edge functions |
| `ai_cache` | input\_hash, kind, model, output (JSON), created\_at | Global; written by edge functions |
| *Deferred:* `collections`, `collection_recipes` | id, user\_id, name, shared flag; child policy follows the collection | Phase 5 |
| *Deferred:* `meal_plans`, `meal_plan_recipes` | plan\_id, user\_id, week\_of, recipe\_id, servings, slot, status, cook\_event\_id | Phase 4 |
| *Deferred:* `inbox` | from\_user, to\_user, recipe\_id, note, seen\_at; sending a private recipe makes it readable to the recipient | Phase 5 |
| *Deferred:* `push_subscriptions` | user\_id, endpoint, p256dh, auth, created\_at | Phase 3 |
| *Deferred:* `units` | unit, to\_g or to\_ml, ingredient-specific densities | Phase 3 |
| *Deferred:* `receipt_lines`, `price_observations` | raw\_text, ingredient\_id, store, price, unit, observed\_on | Phase 3 receipts; feeds Section 10 |

Start capturing `receipt_lines` and `price_observations` the day receipt scanning ships in phase 3, even though nothing uses them until Section 10: the budget planner needs weeks of history, and the raw lines double as the receipt eval set.

## 6. Architecture

A static PWA plus Supabase covers everything; the only paid piece is a small AI model called from edge functions, which keeps keys off the phones and enforces the spend cap.

&#91;embedded content: system architecture · phones, Supabase, AI and data sources\]

Phones read and write through Supabase's row-level security; anything that costs money (AI calls, recipe fetching) goes through an edge function. Grocery APIs are dashed because they arrive only in later phases.

| Layer | Choice | Monthly cost |
| --- | --- | --- |
| App | React + TypeScript + Vite, built as a PWA (same stack family as your other React project) | $0 |
| Hosting | Vercel Hobby (personal use allowed; Git integration, zero config). If Cloudflare, use Workers static assets, not Pages, which is deprecated for new projects | $0 |
| Database, auth | Supabase free tier: Postgres, email magic-link sign-in, row-level security | $0 |
| Server logic | Supabase Edge Functions (TypeScript): AI proxy, recipe import with URL-fetch guards, daily digest (phase 3). Scoring is a shared dependency-free \`engine\` package imported by both the PWA and the functions | $0 |
| AI | Claude Haiku 5.5 (claude-haiku-5-5) with native JSON-schema output via output_config.format, effort: low, no temperature parameter; vision needed only from phase 3 | Under $1 for two users |
| Notifications | Web Push from a scheduled edge function | $0 |
| Seed data | USDA FoodKeeper, USDA FoodData Central, Open Food Facts | $0 |
| Domain | Optional; free subdomain works | \~$1 averaged |

Notes: Supabase pauses free projects after about a week without user database activity (pg_cron alone may not count) and does not back them up, so a GitHub Action does a real read-and-write keep-alive every 2–3 days and a weekly `supabase db dump` into a private backup repo. Put those cron workflows in the private backup repo, not the public app repo: GitHub disables scheduled workflows on public repos after 60 days without commits. Free edge functions get 2 s of CPU per request and 150 s wall-clock, which is fine for the AI proxy (waiting on the model is not CPU) but means the import function must not parse huge pages; cap at 2 MB. Photos go straight to the edge function and are discarded after extraction; recipe `image_url` is a link to the source site, so no file storage is needed. Recipe import parses schema.org Recipe data in TypeScript; the Python `recipe-scrapers` library's host list is the reference for coverage, and its npm port is worth evaluating inside the edge function.

## 7. AI usage and cost controls

Five kinds of AI call (two in v1, three in phase 3), all through one edge function, all returning strict JSON validated against a schema; at two users' volume the total should stay under $1 a month, with a hard cap well above that.

| Call | Input | Output | When AI is skipped | Rough volume (two users) |
| --- | --- | --- | --- | --- |
| Recipe extraction | Web page text, screenshot or pasted text | Title, servings, steps, ingredient lines, tags | Page has schema.org Recipe data: parse it directly, AI only for roles and tags | \~20/month at first, fewer later |
| Ingredient line parsing | "2 large eggs, beaten" + your canonical list | quantity, unit, canonical ingredient, role | Exact or fuzzy synonym hit | Batched per recipe |
| Fridge / pantry photo | Image | List of canonical ingredients with confidence | — | \~8/month |
| Receipt photo | Image | Line items mapped to ingredients + prices | — | \~8/month |
| Quick text update | "used the last eggs, bought spinach" | Pantry add/remove actions | Simple patterns handled by a regex first | \~30/month |

Cost controls:

- **Hard monthly spend cap** in the Anthropic Console: a $2 customer spend limit under Settings → Limits, with prepaid auto-reload off, so requests fail with a 400 once hit. Plus an app-side counter in ai_calls that stops calls and shows a message at a per-user monthly limit.
- **Cache by input hash.** Re-importing the same URL or line never calls the model twice.
- **Use the smallest model that passes the eval set** (Section 9). At Haiku 5.5 pricing (~$0.10 per million input tokens) a parsed line costs a fraction of a cent, so lean on the model for fallback extraction and FoodKeeper name matching rather than hand-writing fragile parsers. Every call passes a flat JSON schema (additionalProperties: false, no numeric or recursive constraints); its tokenizer counts about 30% more tokens than earlier models.
- **Resize images** to \~1,024 px before sending; never store them.
- **Always confirm AI output** in the UI (one tap to accept, edit inline). AI suggestions are never written to the pantry silently.
- **Prompts in version control** as files, each with a JSON schema and a few examples, so changes can be tested against the eval set.

## 8. Security, privacy and backup

Two trusted users don't need heavy security, but four basics are non-negotiable because the app holds API keys and personal data.

1. **Row-level security on every table, including child tables.** A user reads and writes only their own pantry, lists, staples, settings and meta. Shared recipes are readable and editable by any household user (`updated_by` recorded), deletable and re-scoped only by their owner; a private recipe is visible to its owner and to anyone it was sent to. `recipe_ingredients` and `collection_recipes` get an explicit `EXISTS` policy against their parent. Users may insert ingredients they create and synonyms they own; seed rows are immutable. The anon key reads nothing. A pgTAP test signs in as two users and checks all of this.
2. **No secrets in the app.** AI and third-party keys live only in edge-function environment variables; a secret scan runs in CI. The PWA ships with just the public Supabase URL and anon key.
3. **Hardened edge functions.** The import function resolves the URL and refuses private and link-local addresses, follows at most 3 redirects, times out at 10 s and caps responses at 2 MB; image inputs are capped at 2 MB and resized server-side; every function verifies the JWT and takes the user id from it, never from the request body.
4. **Closed sign-up, two known users.** Turn off "Allow new users to sign up" in Supabase Auth, create both accounts by hand in the dashboard, and call `signInWithOtp` with `shouldCreateUser: false`. No allowlist table or trigger is needed. Email delivery is the real constraint: Supabase's default sender only delivers to the project's team members, at 2 messages per hour. Your own address works from day one; before her account (phase 5) either add her as a team member on the Supabase org or configure a free custom SMTP provider such as Resend.
5. **One-tap export and off-platform backup.** A JSON export of recipes, notes, pantry and settings runs client-side under RLS; a weekly GitHub Action dumps the database to a private repo. If you ever change stacks, nothing is lost.

Privacy: no photos are stored; receipts keep only line items and prices; no analytics or ad SDKs.

## 9. Evaluation and portfolio deliverables

A small, honest eval set makes the AI choices testable and gives you measured numbers to quote in interviews.

| Eval set | Size | Metric | Target |
| --- | --- | --- | --- |
| Recipe URLs (mix of sites with and without structured data) | 30 | Ingredient lines mapped to the right canonical ingredient; role (main / optional / essential) correct — measured separately | mapping ≥ 90%, role ≥ 75% |
| Recipe screenshots / cookbook photos | 10 | Same as above, plus steps complete | ≥ 85% |
| Fridge photos from your own kitchen | 20 | Precision and recall of visible ingredients | Recall ≥ 80%, precision ≥ 85% |
| Receipts from your usual stores | 10 | Line items mapped to the correct ingredient | ≥ 85% |
| Leftover pairing scenarios | 15 hand-written cases | A sensible follow-up recipe in the top 3 | 12 of 15 |

Run the eval script whenever a prompt or model changes and keep the results in the repo.

Portfolio deliverables:

- [ ] README with the problem ("never waste the other half"), screenshots, and the architecture diagram
- [ ] Eval results table with the model used and cost per call
- [ ] 60-second demo video: import a recipe → see its leftovers → get a pairing → check the unlock list
- [ ] A short write-up of one hard problem (ingredient canonicalization is the best candidate)
- [ ] Public repo with secrets removed and a seeded demo account

## 10. Later phases

Budget and price features come after v1 because the hard part is price data, not the planning math; the engine and `price_observations` table are already shaped for them.

6. **Budget planner** — "Spend $100 this week, high protein." Adds a cost term to the planning engine: items already in the pantry count as free, shared ingredients are favored, tags and protein target must be met, and the estimated total stays under budget. Price estimates come from your own receipt history (median recent price per ingredient per store), with a manual override.
   - Done when: a generated week stays within ±10% of your actual receipt total.
7. **Price comparison** — show the cheapest store for this week's list from your own price history; add a store API where one exists. Kroger's developer API may expose prices and promotions for Kroger-family stores such as Ralphs (not verified). Instacart's public API does not expose prices. Some stores, like Trader Joe's, have no usable online prices.
8. **Deals** — highlight recipes whose main ingredients are on sale at your stores. Avoid scraping weekly ads where terms forbid it; prefer official APIs or manual entry of a few key deals.

Other ideas parked for later: weekly recap (used vs wasted, average protein, money saved), voice input, store-aisle sorting, and a cooking mode with screen-on and step timers if not already done in phase 4.

## 11. Open decisions

Decided after the review pass (see the Review tab for the reasoning behind each).

| Decision | Options | Decision |
| --- | --- | --- |
| Relationship to your existing React "ours & mine" app | Module inside it · separate app reusing its stack | Separate repo and app, reusing stack and auth patterns: cleaner portfolio piece, less coupling |
| Where scoring runs | In the browser · in an edge function | Both: one dependency-free \`engine\` package runs in the browser for interactive screens and in an edge function for the digest |
| Framework | Vite SPA · Next.js | Vite SPA with vite-plugin-pwa and TanStack Query; no server rendering needed |
| Recipe source priority | Websites · screenshots · short videos | Websites, then pasted text; screenshots in phase 3; video dropped |
| AI model | Claude Haiku class · other small vision models | Pick by eval-set score and cost per call; start Haiku-class with structured JSON output, one provider, and call it only for lines the synonym match misses |
| Use Mealie as the recipe backend | Yes · no | No: needs an always-on server and doesn't fit two separate pantries cleanly |
| Offline scope | Shopping list only · read-only everything · full offline edits | App shell and cached reads work offline; shopping-list check-off is queued offline; all other writes need a connection |

Three further decisions made in the review: ingredients use a one-level hierarchy (`parent_id`); near-match ranks by missing-item count with an essential flag, coverage ratio only breaks ties; either household user can edit a shared recipe, with `updated_by` recorded.

## 12. Prompts to hand to Fable

The review pass is done (Review tab). Use the prompt below in Claude Code to start building; export this doc as Markdown and attach it, and point Claude Code at the Review tab's task list for session boundaries.

**Prompt 1 — Spec review**

```
You are reviewing the attached build spec for a personal pantry and recipe web app. Two users, separate kitchens, one shared cookbook, budget $0–2/month. Headline goal: "never waste the other half" of one-off ingredients.

Please:
1. Find the biggest risks and wrong assumptions, ranked by how likely they are to sink the project.
2. Stress-test the core logic in Section 4 (canonical ingredients, 70% coverage score, leftover prediction, unlock list, expiry confidence, planning engine). Give concrete failure cases with example recipes and pantries, and propose fixes.
3. Check the data model (Section 5) for missing fields, tables or relationships needed by the phases in Section 3.
4. Check the security model (Section 8), especially row-level security for shared recipes vs private pantries.
5. Suggest scope cuts that keep the headline goal intact for a first usable version in 2–3 weekends.
6. Give your recommendation on each open decision in Section 11, with reasoning.
7. Produce a revised phase 0 + phase 1 task list, ordered, each task small enough for one Claude Code session.

Be direct. Disagree with the spec wherever you think it is wrong.
```

**Prompt 2 — Build phase 0 in Claude Code**

```
Using the attached spec (Sections 4, 5 and 8 are authoritative; where docs/review.md disagrees, the spec wins) and the task list in the Review tab (Section 7), build phase 0 one task per session, in order:
- pnpm workspace: apps/web (Vite + React + TypeScript + Tailwind + vite-plugin-pwa) and packages/engine (pure TS, no dependencies), with ESLint, Prettier, Vitest and a GitHub Action running lint, tests and a gitleaks secret scan.
- Supabase migrations for the v1 tables in Section 5 (including parent_id, storage_guidelines, substitutes, user_staples, ai_calls, ai_cache); write docs/schema-later.md for the deferred tables.
- Row-level security policies as specified in Section 8, including EXISTS policies on child tables, and a pgTAP test (supabase test db) with two users: A cannot read B's pantry; both read a shared recipe; A cannot read B's private recipe; A can update but not delete B's shared recipe; anon reads nothing.
- Magic-link sign-in with sign-ups disabled in Supabase Auth and signInWithOtp({ shouldCreateUser: false }); no allowlist table. Document in README that users are created by hand in the dashboard.
- Seed script: ~15-row curated shelf-life table and ~200 canonical ingredients with synonyms, category, parent_id, default storage, package size, perishable and freezes_well flags (draft the values; mark any you are unsure of).
- engine.resolveIngredient with tests: scallions and spring onion → green onion; "green onion" must not resolve to onion; coconut cream must not resolve to coconut milk; "pepper to taste" → black pepper; "1 red pepper" → bell pepper.
- An edge-function skeleton that proxies calls to claude-haiku-5-5 using output_config.format with a JSON schema and effort: "low" (do not pass temperature), reads the key from environment variables, verifies the JWT, enforces a per-user monthly call limit via ai_calls, and caches by input hash in ai_cache.
Commit in small steps with clear messages. Ask before adding any paid service.
```

Sources referenced in this spec: [USDA FoodKeeper data](https://catalog.data.gov/dataset/fsis-foodkeeper-data), [Plan to Eat on digital pantries](https://learn.plantoeat.com/help/a-digital-pantry-inventory-does-it-really-help), [CookCLI greedy coverage](https://cooklang.org/blog/14-greedy-coverage-blog/), [Instacart Developer Platform](https://docs.instacart.com/developer_platform_api/). Market context is in the separate market research brief.
