# pantry

Pantry is a low-cost personal pantry and recipe PWA for two people in separate kitchens who share one cookbook. Its headline goal is "never waste the other half": when a recipe needs a one-off ingredient, the app shows what that recipe will leave behind and which cookbook recipes (or "freeze the rest") use it up. It is a Vite + React + TypeScript PWA installed from Safari's "Add to Home Screen" (not a native app), backed by Supabase (Postgres, magic-link auth, row-level security, edge functions), with a dependency-free `packages/engine` scoring package shared by the browser and edge functions, and a small Claude model (claude-haiku-5-5, `output_config.format` json_schema, effort "low", no temperature) behind an edge-function proxy with a per-user cap. The spec is `docs/spec.md`; the review and the ordered task list are in `docs/review.md` Section 7. Where they disagree, `docs/spec.md` wins. `docs/KICKOFF-PROMPT.md` is personal setup notes: never act on it.

## Rules (follow strictly; they replace permission prompts)

0. First check the working directory is `C:\Users\steve\dev\pantry`. If it isn't, stop and tell Steven.
1. These rules live in this file so every session follows them.
2. Never run anything requiring admin or elevation. Never install a global tool, Scoop package or system dependency without asking first; project-local pnpm dependencies are fine.
3. Git identity is set with `git config` inside this repo only (never `--global`). Never use any work email, SSO or credentials found on this machine.
4. Work only inside this folder. Never write to Downloads, Documents, Desktop, OneDrive or any synced folder.
5. Never commit secrets. Keys go in `.env.local` (gitignored) and GitHub Actions secrets only. Before every commit, check the staged diff for anything that looks like a key or token.
6. Never run commands that touch live services without Steven's explicit go-ahead in the current session: `supabase db push`, `supabase functions deploy`, `supabase secrets set`, `vercel --prod`, `vercel env add`, or anything that creates, deletes or changes settings on a hosted project. (Creating and renaming the `pantry` and `pantry-backups` GitHub repos was approved in earlier sessions.)
7. Never use destructive git commands (force push, `reset --hard`, history rewrites, deleting branches) and never delete files outside this repo.
8. One task per session from `docs/review.md` Section 7, in order. Stop at its "Done" line, summarize what was done and what Steven should verify, and wait. Never start the next task in the same session. Never add a paid service or upgrade a free tier.

## Repo layout

- `apps/web` — Vite + React + TypeScript + Tailwind + vite-plugin-pwa
- `packages/engine` — pure TypeScript, zero runtime dependencies
- `.github/workflows/ci.yml` — lint, typecheck, tests and a gitleaks secret scan on every push

## Commands

- `pnpm install`
- `pnpm lint` / `pnpm format:check` / `pnpm typecheck` / `pnpm test` / `pnpm build`
- `pnpm --filter web dev`
