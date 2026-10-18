# Review of Build Spec v1

Oct 17, 2026 · @Steven

The principles in Section 1 are right; the roadmap and the scoring math are not. The headline feature sits behind four phases of intake and infrastructure it does not need, and the 70% ratio, package-size arithmetic and unnormalized score will give wrong answers on ordinary recipes. Reorder so leftover pairing lands right after recipe import, switch to missing-item counts, and cut photo intake, push, protein and prep from the first version.

**Status:** Steven accepted the reorder and scope cuts, missing-item count with an essential flag (ratio as tiebreaker), and household-wide recipe editing with `updated_by`. The spec tab has been updated to match; the sections below record the review as it stood against v1 and remain the reasoning behind each change.

## 1. Risks, ranked

The top two are structural: the roadmap never reaches the headline feature in a reasonable time, and that feature depends on package-size data nobody has. Everything below them is fixable in a session.

| # | Risk | Wrong assumption | Why it sinks the project | Fix |
| --- | --- | --- | --- | --- |
| 1 | Headline feature lands in phase 3, after cookbook, photo intake, receipts and push | "As soon as the cookbook and pantry exist" — but phase 2 as written is six features deep | Leftover pairing needs recipes and package sizes, not a pantry. Six-plus weekends before the one thing you want to demo. | Move leftover prediction and pairing to the phase right after import. Pantry becomes an input that improves it, not a prerequisite. |
| 2 | Leftover = package size − amount used | A "typical package size" exists per ingredient | Cilantro is a 0.75 oz clamshell or a bunch; coconut milk is a 13.5 oz can or a 400 ml carton; chicken thighs are 1.5 lb or a 3 lb family pack. Most produce lines cannot convert cups→bunches either, so the arithmetic yields "partial" almost always. | Make leftover a three-state label (none / some / most) from coarse rules; let the user pick the package at check-off and keep a per-user override. Treat the subtraction as a tiebreaker, not the model. |
| 3 | Cookbook is too small for pairing and near-match to say anything | 30 recipes is a usable corpus | Pairing for cilantro needs ≥2 cookbook recipes that use cilantro. With 30–50 recipes most one-offs have zero partners and "almost there" is empty. | Target 100+ recipes before judging the feature. Add a fallback: an LLM one-liner ("3 things to do with half a bunch of cilantro") saved as a recipe stub you can promote. |
| 4 | 70% ratio with equal weights | Any 70% of mains is a dish | Pad thai missing tamarind and fish sauce scores 82%; scrambled eggs missing chives scores 67%. Small recipes are penalized, big ones pass while missing the defining item. | Rank by missing-item count (0, 1, 2) with an "essential" flag; ratio only as tiebreaker. Details in Section 2. |
| 5 | Scope: 16 tables, 5 AI call types, offline sync, iOS web push | One person can build this in a few months of weekends | Each is a weekend on its own. iOS web push needs the app installed and a user-gesture permission prompt and still misfires. | Cut list in Section 5. Push and offline writes are v2. |
| 6 | 90% first-pass parse target mixes two problems | Canonical mapping and role assignment are one accuracy | Mapping to 400 canonical ingredients will hit \~90%; main/staple/optional is subjective and will land nearer 75%. One number hides which is failing. | Measure mapping and role separately; set 90% and 75%. |
| 7 | Inventory drift kills trust (the brief's own finding) | Decay + "cooked this" is enough | Deduction on "cooked this" needs the same quantity math as leftover prediction; opened\_on is never logged. | Infer opened\_on from the first cook event that uses the item. Design every surface to work when the pantry is 70% right — the unlock list and pairing already do; the digest does not. |
| 8 | Portfolio value is in the demo and write-up, not table count | More schema = stronger portfolio | Hiring managers for SE roles watch the 60-second demo and read the canonicalization write-up. Phases 4–5 add nothing to either. | Ship phases 0–3 with the eval table and demo video before touching protein or prep. |
| 9 | Supabase free tier: no automatic backups, project pauses after 7 days idle | "Scheduled weekly backup" is a checkbox | Daily backups are a paid feature. A paused project breaks her magic link the week you both travel. | GitHub Action: weekly `supabase db dump` to a private repo, daily keep-alive query. Section 4. |
| 10 | Global synonym table written by users | Two people's confirmed mappings never conflict | Her "pepper → bell pepper" becomes your "pepper to taste → bell pepper". | Per-user synonyms; promote to global only when both confirm or you review. |

## 2. Section 4 stress test

Three changes fix most of the cases below: a parent/child ingredient hierarchy, missing-item counts instead of a ratio, and one `score(recipe, virtualPantry, goals)` function that the planner calls in a loop. Each table row is a case the current spec gets wrong.

### 4.1 Canonical ingredients

| Case | What the spec does | Why it is wrong | Fix |
| --- | --- | --- | --- |
| Recipe wants "chicken breast"; pantry has chicken thighs | Either one canonical "chicken" or four unrelated rows | One row: expiry and leftover wrong (rotisserie keeps 3–4 days, raw thighs 1–2). Four rows: coverage says you have nothing. | `ingredients.parent_id`. Match at the leaf; fall back to the parent and mark the line "substitute". |
| "1 red pepper, diced" vs "pepper to taste" | Fuzzy match on the noun | Both resolve to the same row half the time | Resolve with quantity and unit as context: a unit of "to taste" or "pinch" biases to the spice. Add both as explicit synonyms with disambiguation rules. |
| "coconut milk", "coconut cream", "cream of coconut" | Fuzzy match collapses them | Three different products; cream of coconut is sweetened | Fuzzy threshold ≥ 0.85 on the stripped noun phrase, and a `not_synonyms` list for known near-misses. |
| "green onion" not yet a synonym | Trigram fuzzy | Matches "onion" with high similarity | Strip prep words, then require token overlap on the head noun before trigram. Phase 0 test should include this negative case. |
| She confirms "pepper → bell pepper" | Saved as a global synonym | Your "pepper" lines now map to bell pepper | Synonyms carry `user_id`; global only for seed and reviewed promotions. |

### 4.2 Roles

| Case | What the spec does | Why it is wrong | Fix |
| --- | --- | --- | --- |
| Fish sauce is a staple for you, not for her | `role` on the recipe line is staple or main | A shared recipe cannot be both | Recipe lines are `main` or `optional` only. "Staple" is computed per user from `user_staples` at scoring time. |
| "Cilantro, for garnish" | `optional`, excluded from coverage | Garnish herbs are the headline orphan; excluding them hides the exact waste the app exists for | Optional lines are excluded from coverage but included in leftover prediction and the shopping list (marked optional). |
| "2 tbsp butter" in a cake vs "a pat of butter" to finish | One role per ingredient | Quantity decides whether an item defines the dish | Add an `essential` flag (1–2 lines per recipe, LLM-proposed). Missing an essential = not cookable regardless of ratio. |

### 4.3 Match score (the 70% rule)

| Case | Spec answer | Right answer | Fix |
| --- | --- | --- | --- |
| Pad thai: 11 mains, missing tamarind and fish sauce | 9/11 = 82%, "almost there" | Not makeable | Essential flag (above) zeroes coverage. |
| Scrambled eggs with chives: 3 mains, missing chives | 67%, hidden below 70% | Cook now, skip the chives | Rank by missing count: 0 = cook now, 1 = "1 away", 2 = "2 away". The spec's own UI copy already says "1–2 items away"; make the math match the copy. |
| Recipe needs 2 lb chicken; pantry says chicken "low" | Counted as have | Probably not enough | `amount_state` weights: full 1.0, half 0.7, low 0.3 for mains; staples ignore it. Show "check: chicken is low". |
| Pantry cilantro at confidence 0.2 (bought 10 days ago) | Counted as have | "Probably gone" | Coverage sums confidence, not presence. Cook now requires every main ≥ 0.7; otherwise "probably — confirm cilantro". |
| Substitutes listed per recipe line | `substitute_ids[]` on `recipe_ingredients` | Nobody will annotate 200 recipes | Global `substitutes(a, b, strength)` on ingredients: lime↔lemon, shallot↔onion, Greek yogurt↔sour cream. Strength lowers the line's coverage to 0.8. |

### 4.4 Leftover prediction and pairing

| Case | Spec answer | Right answer | Fix |
| --- | --- | --- | --- |
| "¼ cup chopped cilantro", package "1 bunch" | Cannot convert → "partial" | Most of a bunch left | Rules on used/package when convertible (<0.25 → most, 0.25–0.75 → some, >0.75 → none). Unconvertible perishable → "some". Stop pretending the subtraction is the model. |
| Recipe uses 1 cup milk from a half gallon | Milk is an orphan every week | You drink milk | Broaden staples to "always have or always finish": milk, eggs, butter, yogurt. Staples never become orphans. |
| You already have half a bunch of cilantro | Predicts a new bunch with half left | Buy nothing; this recipe rescues an existing leftover | Check the pantry before predicting. Existing item → no purchase, and the recipe scores positive for "orphans used". |
| Orphan = "no other planned recipe uses it" | Everything is an orphan until phase 4 exists | Orphan until a pairing is accepted or another cookbook recipe is cookable with it | Define orphan against pairing acceptance, not `meal_plans`. Planner can tighten it later. |
| Pairing candidates: cilantro-lime rice (2 orphans, nothing missing) vs green curry (3 orphans, 6 missing, new bunch of Thai basil) | Curry ranks first on orphans used | Rice | Pairing uses the full score including missing count and `orphans created`; 4.4 and 4.7 currently diverge. |
| Leftover tomato paste, ginger, bread | Suggest a recipe in 3 days | Freeze it | `ingredients.freezes_well` and "freeze the rest" as a first-class suggestion ahead of recipes. |
| Urgency "fewer days left" at pick time | Days left of what? Nothing is bought yet | Fridge life of the leftover after opening | Use `after_opening_days` for predicted leftovers, `expires_on` for pantry items. |

### 4.5 Unlock list

| Case | Spec answer | Problem | Fix |
| --- | --- | --- | --- |
| 40-recipe cookbook, most 2+ away | Buying 3 things unlocks 0 "cook now" → empty list | Feature looks broken early | Secondary objective: recipes moved to ≤1 away. Show "buy X → 2 cook-now, 4 one-away". |
| Cilantro unlocks 5 recipes | Recommended | You will cook one, waste the rest | Penalty already in spec; make it the perishability of the candidate × recipes you will realistically cook (cap at 2/week). Soy sauce unlocking 5 beats cilantro unlocking 5. |
| Recipe is 1 away because of a "probably have" item | Unlock buys the other item | The probably-have is gone; still 1 away | Unlock rows carry "confirm X" alongside "buy Y". |
| Candidate is already on the shopping list | Recommended again | No information | Exclude list items from candidates; show them as "already on your list". |
| 300 candidates, exhaustive 3-sets | 4.5M sets × recipes on a phone | Slow; two code paths | Greedy with one-step lookahead from day one; exhaustive is not worth a second implementation. |

### 4.6 Expiry and confidence

| Case | Spec answer | Problem | Fix |
| --- | --- | --- | --- |
| FoodKeeper says chicken 1–2 days | "FoodKeeper days" is one number | Ranges are the norm | `expires_min`, `expires_max`; urgency uses min, "probably still good" uses max. |
| Jar of soy sauce, 2-year shelf life | Confidence decays over shelf life | Decays to zero in 2 years; you may have finished it in a month | Confidence = P(still have). Decay by cook events that used it and time since confirmation; staples floor at "probably". `expires_on` = P(still good). Keep the two separate. |
| Opened\_on never logged | Opening switches to after-opening time | Never switches | Infer `opened_on` from the first `cook_event` that uses the item. |
| Frozen chicken | Clock paused | Freezer life is 9–12 months, not forever; thawed meat is 1–2 days | Use the FoodKeeper freezer timeline; add `thawed_on`. Low priority. |
| Receipt date vs purchase date | Same thing | Fine for receipts; photo and text intake have no date | Default `purchased_on` = today, editable; confidence starts lower for photo intake. |

### 4.7 Planning engine

| Case | Spec answer | Problem | Fix |
| --- | --- | --- | --- |
| Terms on different scales | Weighted sum of coverage (0–1), urgency (sum of 1/days, unbounded), orphan counts | Weights are meaningless | Normalize every term to 0–1 before weighting. |
| Shared-ingredient bonus for a set of 2–4 recipes | Added to a summed score | Non-additive; the bonus depends on the set | Planner = pairing in a loop: pick the best recipe, add what it leaves to a virtual pantry, re-score, repeat. One function, no set bonus. |
| Protein per serving from `protein_per_100g × quantity` | Ingredient-level math | Same unconvertible units as leftovers ("2 chicken breasts") | Have the LLM estimate `protein_per_serving` at import, flagged `estimated`, ±20%. Add `unit_weight_g` later if you want exact. |
| Dietary exclusions as a weight | `tag match` term | Exclusions are hard filters | Filter before scoring. |

## 3. Data model gaps

Four tables are missing outright (`storage_guidelines`, `substitutes`, `ai_calls`, `push_subscriptions`), and three of the listed ones need a different shape. Defer `meal_plans`, `inbox`, `collections` and `price_observations` to later migrations; keeping them in a `docs/schema-later.md` costs nothing and keeps phase 0 small.

| Table | Gap | Needed by |
| --- | --- | --- |
| `ingredients` | `parent_id` (hierarchy), `freezes_well`, `unit_weight_g` (what "1 breast" or "1 bunch" weighs), `fridge_days_min/max`, `pantry_days`, `freezer_days`, `after_opening_days`. A single `foodkeeper_id` is not enough: FoodKeeper has several rows per food (fresh, cooked, opened). `created_by` so LLM-proposed new ingredients have an owner. | Phases 0, 3 |
| `storage_guidelines` (new) | The FoodKeeper import target that Prompt 2 names but Section 5 omits: `foodkeeper_id`, `name`, `category`, storage timelines by location, `metric`. `ingredients` points at it. | Phase 0 |
| `ingredient_synonyms` | `user_id` (null = global), `confirmed_at`, `source` (seed / llm / user). | Phase 0, 10th risk |
| `substitutes` (new) | `ingredient_a`, `ingredient_b`, `strength`, `symmetric`. Replaces `substitute_ids[]` on recipe lines. | Phase 3 |
| `recipes` | `source_type` (url / photo / paste), `source_hash` (import cache key), `image_url` (the source's hero image, a URL not a file), `description`, `total_minutes`, `protein_estimated` flag, `model_version`, `updated_by`, `deleted_at` (soft delete on a shared table). | Phases 1, 4 |
| `recipe_ingredients` | `position` and `section` ("for the sauce"), `essential`, `quantity_max` ("1–2 cloves"), `unit_raw` vs `unit`, `prep` ("diced"). Drop `staple` from `role`; drop `substitute_ids`. | Phases 1, 3 |
| `user_staples` (new, replaces `staples[]`) | `user_id`, `ingredient_id`, `assumed_present`, `out_since`. An array cannot be marked "out of this one". | Phases 2, 3 |
| `pantry_items` | `kind` (raw / cooked), `source_cook_event_id` (cooked portions entering inventory), `expires_min/max` instead of one date, `thawed_on`, `package_override`, `note`. | Phases 2, 4 |
| `shopping_list_items` | `origin` (manual / recipe / unlock / pairing), `probably_have` display state (the "never silently remove" principle needs somewhere to live), `quantity_note`, `added_by`. | Phases 2, 3 |
| `cook_events` | `deductions` JSON (what was subtracted, so it can be undone), `portions_stored`, `note`. | Phases 3, 4 |
| `ai_calls` (new) | `user_id`, `kind`, `input_hash`, `model`, `tokens_in`, `tokens_out`, `cost_cents`, `cached`, `created_at`. The per-user cap and the portfolio cost table both need it. | Phase 0 |
| `ai_cache` (new) | `input_hash` → `output` JSON, `model`, `created_at`. | Phase 0 |
| `push_subscriptions` (new) | `user_id`, `endpoint`, `p256dh`, `auth`, `created_at`. The daily digest cannot send without it. | Phase 2 (if push survives the cut) |
| `units` (new, small) | Unit → ml or g, plus a few ingredient-specific densities. Needed the moment any subtraction runs. | Phase 3 |
| `receipt_lines` (new, later) | Raw line text, mapped ingredient, price, store. `price_observations` derives from it; the eval set needs the raw lines. | Phase 2 receipts |
| `meal_plans` | `slot` (day, meal), `status`, `cook_event_id`. | Phase 4 |
| `recipe_user_meta` | Fine. Derive `last_cooked_at` and `times_cooked` from `cook_events` rather than storing them. | — |

Two relationship notes. First, "shared" means shared with whom: with invite-only sign-up, `visibility = shared` can mean "any authenticated user", which is fine, but say so and name it `household`. Second, `collections` is listed per user with a shared flag; if a collection can be shared, `collection_recipes` needs its own policy that follows the collection, not the user.

One conflict: "no photos stored" is right for the database, but the fridge-photo eval set in Section 9 needs 20 photos. Keep them in the repo under `eval/photos/` (gitignored if you like), never in Supabase.

## 4. Security model

The four basics are the right four. The gaps are in the details of RLS on child tables, who can edit a shared recipe, the import function fetching arbitrary URLs, and backups that do not exist on the free tier.

### Row-level security

| Table | Spec says | Problem | Policy to write |
| --- | --- | --- | --- |
| `recipes` | Readable by both, editable by owner | You cannot fix a parse error on a recipe she imported; "either can add" implies either can fix. | Any authenticated user reads `shared` or own `private`; any authenticated user updates `shared` (record `updated_by`); only owner deletes or flips visibility. Two trusted users; provenance beats locks. |
| `recipe_ingredients` | "Follows recipe" | There is no automatic following; without an explicit policy the table is either open or closed. | `EXISTS (SELECT 1 FROM recipes r WHERE r.id = recipe_id AND (r.visibility = 'shared' OR r.owner_id = auth.uid()))` for select and write. |
| `recipes` via `inbox` | Sender and recipient see the inbox row | If she sends you a private recipe, the row is visible and the recipe is not. | Recipe read policy adds `OR EXISTS (inbox row to_user = auth.uid())`, or sending flips the recipe to shared. |
| `ingredients` | Global, read-only to users | Confirmed LLM proposals must create new rows; the spec gives no write path. | Authenticated insert with `created_by = auth.uid()`; update and delete only by `created_by`. Seed rows have null owner and are immutable. |
| `ingredient_synonyms` | Global, user mappings appended | A user write to a global table is a shared-state bug (risk 10). | Insert only where `user_id = auth.uid()`; select where `user_id IS NULL OR user_id = auth.uid()`. |
| `collections` / `collection_recipes` | Per user, shared flag | Child table needs its own policy. | Same EXISTS pattern against `collections`. |
| All self-only tables | Own rows only | Fine. | `user_id = auth.uid()` on every command, including insert `WITH CHECK`. |
| `anon` role | — | Not mentioned. | Explicit test that the anon key reads zero rows from every table. |

Write the RLS test as pgTAP (`supabase test db`) or a Deno test with two JWTs, covering: A cannot read B's pantry; both read a shared recipe; A cannot read B's private recipe; A can update B's shared recipe but not delete it; anon reads nothing.

### Edge functions

| Concern | Fix |
| --- | --- |
| `import-recipe` fetches any URL the client sends | Block private and link-local IP ranges after DNS resolution, allow http(s) only, max 3 redirects, 10 s timeout, 2 MB response cap. This is the one real attack surface in the app. |
| AI proxy accepts images | Reject over 2 MB, resize server-side to \~1,024 px, accept only image MIME types. |
| Per-user monthly cap | Count from `ai_calls`; return a typed error the UI shows. Verify the JWT and use `auth.uid()` from it, never a user\_id in the body. |
| Service role key | Only inside edge functions; never in `.env` committed files. Add a secret scan to CI. |

### Sign-up, backup, uptime

| Item | Spec | Reality on the free tier | Do this |
| --- | --- | --- | --- |
| Invite-only | "Disable open registration" | Disabling sign-ups also blocks magic links for new users. | Keep sign-ups on; add an `allowed_emails` table and a `BEFORE INSERT` trigger on `auth.users` that rejects anyone not listed. |
| Weekly backup | "Scheduled weekly backup of the database" | Automatic backups are a paid feature. | GitHub Action on a weekly cron: `supabase db dump` with the DB password in a repo secret, committed to a private backup repo. |
| Project pausing | "Daily use keeps it awake" | A week of travel pauses it; a paused project breaks her login. | Same Action, daily: one authenticated REST read. |
| One-tap export | JSON export | Fine; runs client-side under RLS so it exports exactly what the user can see. | — |

Privacy as written is good. Add one line: recipe `image_url` is a link to the source site, not an upload, so "no photos stored" still holds.

## 5. Scope cuts for a 2–3 weekend version

The first usable version is: import recipes, tick what you have, pick a recipe, see what it leaves behind and what to cook with the rest. That needs about a third of the spec. Everything cut below returns as a later phase; nothing cut touches the headline.

| Area | Keep | Cut (and when it comes back) |
| --- | --- | --- |
| Sign-in | Magic link, email allowlist, your account only | Her account (phase 5 as planned; the RLS is built now, the login is not) |
| Ingredients | \~200 seeded rows with synonyms, parent\_id, perishable flag, package size, freezes\_well; curated 15-row shelf-life table (leafy herbs 5 d, hard veg 14 d, opened dairy 7 d, cooked 4 d, dry goods 365 d) | FoodKeeper import (phase 2); protein per 100 g (phase 4) |
| Recipe import | URL with schema.org, paste text, LLM for unmatched lines only; role main/optional, essential flag | Screenshot and photo import (phase 2); auto-tags; collections; video |
| Cookbook | List, detail with steps, status, search by ingredient | Ratings and notes (phase 5); inbox |
| Pantry | Manual tick-list grouped by category, "about half" state, check-off from shopping list adds, "cooked this" subtracts, simple `expires_on` from the shelf-life table | Fridge photo, receipt photo, quick-text parsing, confidence decay, daily digest, push notifications, freezer pause |
| Other half | Leftover label at pick time, pairing (top 3 from the cookbook, "freeze it" when applicable), LLM stub fallback, post-cook rescue list | — |
| Near-match | Cook now / 1 away / 2 away by missing count | Adjustable threshold, substitutes table (phase 3b) |
| Unlock list | Greedy, 1–3 items, shows cook-now and one-away counts | Orphan penalty tuning, lookahead |
| Protein and prep | Nothing | All of phase 4 |
| Platform | Installable PWA, app shell cached, data reads from a query cache | Offline writes, background sync |
| Ops | `ai_calls` cap and cache, RLS test, manual `db dump` once | Scheduled backup and keep-alive Action (do in week 4), export button |
| Eval | 10 of your recipe URLs with gold ingredient lines; script prints mapping % and role % | 30 URLs, photo and receipt sets, pairing scenarios (add as the cookbook grows) |

Weekend 1: phase 0 tasks 0.1–0.8 below. Weekend 2: phase 1 tasks 1.1–1.6 and the manual pantry. Weekend 3: leftover labels, pairing, near-match counts, unlock, demo video.

What you lose by cutting photo intake: nothing the headline needs. The brief says adding food is the easy half and the demo moment is the unlock list; both survive a tick-list pantry. What you lose by cutting confidence decay: the use-soon list is slightly wrong for a few weeks. Acceptable.

## 6. Open decisions

Five of the seven leans are right. I disagree on where scoring lives (it must run in both places) and on offline scope (too wide for v1). Three decisions the spec has not yet made matter more than most of the seven.

| Decision | Spec lean | Recommendation | Reasoning |
| --- | --- | --- | --- |
| Relationship to the "ours & mine" app | Separate repo | Agree | A portfolio piece needs its own README, demo and commit history. Copy the auth pattern, not the code. |
| Where scoring runs | Browser | Both: a dependency-free `packages/engine` TypeScript package, imported by the PWA and by edge functions | Section 6 already lists "scoring" under edge functions and the daily digest needs server-side use-soon and pairing. Browser-only contradicts the spec's own table. A pure package with unit tests is also the best write-up material. |
| Framework | Vite SPA | Agree: Vite + React + TypeScript + vite-plugin-pwa, TanStack Query for the data layer | No SSR, no SEO, two users. Next.js adds a server you do not want to pay for or debug. |
| Recipe source priority | Websites and screenshots first, video later | Websites first, paste second, screenshots third, video never in v1 | Video captions rarely contain quantities; the eval set would be mostly failures. Drop it from the roadmap rather than parking it. |
| AI model | Pick by eval | Agree; start with a Haiku-class model using structured JSON output, one provider, and send only the lines the synonym match misses | Per-line fallback keeps volume near zero. The eval set decides any change; note the model name and cost per call in the results table. |
| Mealie as backend | No | Agree | Always-on server, single-household model, and it would own the recipe schema your engine depends on. |
| Offline scope | List and cookbook readable, edits sync | Narrower: app shell and cached reads offline; one offline write, shopping-list check-off, queued in IndexedDB | Generic edit sync is a project in itself. Check-off at the store is the only write that happens without signal. |

### Decisions the spec still needs to make

| Decision | Recommendation |
| --- | --- |
| Flat ingredient list or hierarchy | Hierarchy with `parent_id`, one level deep. Without it, chicken parts, onion varieties and pepper types each break either matching or expiry. |
| Ratio or missing count for near-match | Missing count with an essential flag. Keep `coverage_threshold` in settings only if you want the ratio as a tiebreaker. |
| Who edits a shared recipe | Both users, with `updated_by`. The alternative leaves parse errors nobody can fix. |

## 7. Revised phase 0 + phase 1 task list

Sixteen sessions, each 1–3 hours and each ending in a commit with a passing test or a screenshot. Phase 0 is two sessions shorter than the spec's because FoodKeeper, push and the deferred tables are out; phase 1 adds the eval harness early so the 90% number exists before the UI does.

### Phase 0 — Foundations (weekend 1)

1. **Repo scaffold.** pnpm workspace with `apps/web` (Vite + React + TS + Tailwind + vite-plugin-pwa) and `packages/engine` (pure TS, no deps). ESLint, Prettier, Vitest, GitHub Action running lint and tests. Done: CI green on an empty engine test.
2. **Supabase project and migration 001 — reference data.** Local CLI linked to the project. Tables: `profiles`, `user_settings`, `ingredients` (with `parent_id`, shelf-life columns, `freezes_well`, `package_size`, `package_unit`, `perishable`, `created_by`), `ingredient_synonyms` (with `user_id`, `source`), `substitutes`, `storage_guidelines`. Done: `supabase db reset` runs clean.
3. **Migration 002 — user data.** `recipes`, `recipe_ingredients` (with `position`, `section`, `essential`, role main/optional), `recipe_user_meta`, `user_staples`, `pantry_items`, `shopping_list_items`, `cook_events`, `ai_calls`, `ai_cache`. Write `docs/schema-later.md` listing the deferred tables with their columns. Done: reset runs clean; ERD exported to `docs/`.
4. **RLS policies and test.** Every policy from Section 4 of this review, including the EXISTS pattern on `recipe_ingredients` and anon-reads-nothing. pgTAP test with two seeded users. Done: all five assertions pass in CI.
5. **Auth, closed sign-up.** Magic-link sign-in page with `signInWithOtp({ shouldCreateUser: false })`, sign-ups disabled in Supabase Auth, your user created by hand in the dashboard, session persistence, sign-out. (Superseded the allowlist-trigger plan after research: see spec Section 8.) Done: your email signs in on your phone; an unknown email gets no link.
6. **PWA shell and deploy.** Manifest, icons, service worker caching the shell, install prompt copy for iOS and Android, deploy to Vercel Hobby with env vars. Done: installed on your home screen from the public URL.
7. **Seed data.** `seed/ingredients.csv` with \~200 rows and synonyms, `seed/shelf_life.csv` with \~15 category rows, idempotent seed script. Mark uncertain package sizes. Done: seed runs twice without duplicates; `select count(*)` matches the CSVs.
8. **Engine: `resolveIngredient`.** Normalize (strip quantity, unit, prep words), exact synonym, head-noun token match, trigram fuzzy at ≥ 0.85, user synonyms before global. Tests: scallions / spring onion → green onion; "green onion" does not resolve to onion; coconut cream ≠ coconut milk; "pepper to taste" → black pepper; "1 red pepper" → bell pepper. Done: tests pass; unresolved lines return `null` with candidates.

### Phase 1 — Cookbook (weekend 2)

9. **Engine: `parseIngredientLine`.** Deterministic parser for quantity (fractions, ranges, unicode ½), unit, name, prep note. Test file with 50 real lines copied from your recipes. Done: ≥ 45 of 50 parse to the expected shape.
10. **Edge function: `ai` proxy.** Calls claude-haiku-5-5 with output_config.format JSON schema and effort low (no temperature). JWT verification, `ai_calls` counter with per-user monthly cap, `ai_cache` by input hash, provider key from env, JSON-schema validation of output, prompt files under `prompts/` with examples. Mocked provider in tests. Done: cap and cache behave in tests; a real call parses one line.
11. **Edge function: `import-recipe`.** URL fetch with the SSRF guards, JSON-LD Recipe extraction (handles `@graph`, arrays, HowToStep objects), readability-text fallback to the `ai` function, returns a draft with raw lines. Cache by URL hash. Done: 5 known URLs return correct drafts; a private-IP URL is refused.
12. **Eval harness.** `eval/recipes.json` with 10 of your real URLs and gold ingredient lines (canonical id, role). Script runs import, resolves lines, prints mapping % and role % separately, writes `eval/results/<date>.json`. Done: first numbers committed, whatever they are.
13. **Import review screen.** Paste URL or text → draft → editable title, servings, steps; each line shows the resolved ingredient as a chip with a search-to-fix control, role toggle, essential star. Save writes `recipes`, `recipe_ingredients` and any user-confirmed synonyms. Done: one recipe imported end to end on your phone.
14. **Cookbook list and detail.** List with status filter and search by title or ingredient; detail with ingredients, steps, status control. Done: 10 recipes browsable; search by "cilantro" returns the right ones.
15. **Staples settings.** Screen listing `user_staples` with assumed-present toggle and "out" state; LLM role proposal stops using "staple". Recipe detail shows staples greyed. Done: fish sauce marked staple hides from a recipe's missing list.
16. **Import 30 recipes and re-run eval.** Fix the top three mapping failures as synonyms or seed rows, re-run, commit the second results file, write the README's first section with the numbers. Tag `v0.1`. Done: README shows mapping %, role %, model, cost per recipe.

Weekend 3 then starts the headline: leftover labels at pick time (engine), pairing with the virtual pantry, near-match by missing count, greedy unlock, and the demo video. I can write that list once you have decided which of the fixes above to accept.
