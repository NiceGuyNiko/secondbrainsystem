# Staging setup — Phase 0.5

Goal: Preview deployments and local development use a **separate staging Supabase project**. Production uses production. A deployment whose configuration is missing or points at the wrong project **refuses to build** and, if somehow built, renders a configuration error without contacting any database.

Never paste passwords, database passwords, secret keys or service-role keys into chat, code or commits. The publishable key is designed to be public, but it is still entered only in Vercel and local `.env` files.

## What the repository now does (branch `feature/phase-0.5-staging`)

| Piece | File |
|---|---|
| Environment rules (production↔production, preview/local↔staging, secret keys rejected, nothing missing) | `lib/environment.ts`, tests in `tests/environment.test.ts` |
| Build-time refusal — a misconfigured build fails, so Vercel keeps the previous deployment | `next.config.ts` |
| Runtime fail-safe — no Supabase client is created; a configuration error screen is shown | `lib/supabase.ts`, `components/environment.tsx`, `app/page.tsx` |
| Amber **STAGING DATA · ‹project ref›** badge and `[Staging]` tab title on every staging page, including sign-in | `components/environment.tsx`, `app/layout.tsx`, `app/globals.css` |
| Guarded migration helper (refuses unless the CLI is linked to the staging project) | `scripts/staging-migrate.ts`, `npm run staging:migrate` |
| Permission and read/write check with two staging users | `scripts/staging-verify.ts`, `npm run staging:verify` |
| Variable template | `.env.example` |

Required variables (per environment):

| Variable | Production (Vercel "Production") | Preview (Vercel "Preview") and local `.env.local` |
|---|---|---|
| `NEXT_PUBLIC_AAA_DATA_ENV` | `production` | `staging` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://rpjeqbbvocgwomiavxqh.supabase.co` | `https://<staging-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | production publishable key | staging publishable key |

Local development (`npm run dev`, `npm run build`) now also requires staging values in `.env.local`. Tests, typecheck and lint need no variables.

## Step 1 — Create the staging project (owner)

1. Supabase dashboard → **New project** in the same organization.
   - Name: `secondbrainsystem-staging`. Region: **East US (North Virginia)** to match production. Plan: Free.
   - Generate a strong database password and store it in your password manager. You need it once, for the CLI link in Step 2.
   - Security options: keep **Data API** enabled. If asked about automatically exposing new tables, choose the same behaviour as production; the parity check in Step 2 confirms the result.
2. Note the **project ref** (in the dashboard URL and Settings → General). The ref is not secret and you can share it with me.
3. Free projects pause after about a week without activity; restore from the dashboard when needed.

## Step 2 — Base schema and parity (owner runs; I prepare)

The four earliest production migrations (profiles, `user_items`, signup trigger) are not in the repository, so staging cannot be built from the repo yet.

1. **Owner — production SQL Editor, read-only (Query 6):** returns the exact SQL production recorded for every applied migration. It contains schema only, no user data.

```sql
select jsonb_pretty(jsonb_agg(jsonb_build_object('version',version,'name',name,'statements',statements) order by version))
from supabase_migrations.schema_migrations;
```

2. **Me:** add the missing migrations to `supabase/migrations/` with their **exact production version numbers**, so production already counts them as applied and nothing is ever re-run there. I also compare the three later migrations with the repository copies.
3. **Owner — in your own terminal** (the CLI asks for your Supabase login in the browser and for the staging database password; neither is shared):

```bash
npx supabase@2.121.0 login
npx supabase@2.121.0 link --project-ref <staging-ref>
npm run staging:migrate            # dry run: should list all migrations for staging
npm run staging:migrate -- --apply # apply to staging
```

`staging:migrate` reads `STAGING_SUPABASE_URL` from `.env.staging.local` (Step 4) and refuses to run if the CLI is linked to production or to any project other than staging.

4. **Owner — parity check, read-only (Query 7):** run in **both** the production and staging SQL Editors and send me both results. Each is one text cell of fingerprints (no data). I diff them; any difference is fixed with a reviewed migration on staging only.

```sql
select string_agg(kind||' '||name||' '||md5(def), E'\n' order by kind, name) from (
 select 'column' kind, table_name||'.'||column_name name, data_type||'|'||is_nullable||'|'||coalesce(column_default,'') def from information_schema.columns where table_schema='public'
 union all select 'constraint', conrelid::regclass::text||'.'||conname, pg_get_constraintdef(oid) from pg_constraint where connamespace='public'::regnamespace
 union all select 'index', indexname, indexdef from pg_indexes where schemaname='public'
 union all select 'policy', tablename||'.'||policyname, cmd||'|'||roles::text||'|'||coalesce(qual,'')||'|'||coalesce(with_check,'') from pg_policies where schemaname='public'
 union all select 'function', p.oid::regprocedure::text, pg_get_functiondef(p.oid) from pg_proc p where p.pronamespace='public'::regnamespace and p.prokind='f'
 union all select 'trigger', tgrelid::regclass::text||'.'||tgname, pg_get_triggerdef(oid) from pg_trigger where not tgisinternal and tgrelid in (select oid from pg_class where relnamespace in ('public'::regnamespace,'auth'::regnamespace))
 union all select 'rls', relname, relrowsecurity::text from pg_class where relnamespace='public'::regnamespace and relkind='r'
 union all select 'grant', table_name||'.'||grantee, string_agg(privilege_type,',' order by privilege_type) from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated') group by table_name, grantee
 union all select 'function_grant', routine_name||'.'||grantee, string_agg(privilege_type,',' order by privilege_type) from information_schema.role_routine_grants where routine_schema='public' and grantee in ('anon','authenticated') group by routine_name, grantee
) x;
```

## Step 3 — Staging authentication (owner)

1. Staging → Authentication → **URL Configuration**:
   - Site URL: `http://localhost:3000`
   - Redirect URLs: `http://localhost:3000/**` and `https://secondbrainsystem-*-niceguyniko.vercel.app/**`
2. Keep email confirmation and password settings the same as production.
3. Authentication → Users → **Add user → Create new user**, tick *Auto Confirm*, twice: test users A and B. Use addresses you control (for example `+staging-a` / `+staging-b` aliases) and passwords that are **not** used anywhere else. Production accounts do not exist in staging; that is intended.

## Step 4 — Local files (owner)

Create, in the repository folder (both are git-ignored by `.env*`):

- `.env.local` — the three staging variables from `.env.example`.
- `.env.staging.local` — `STAGING_SUPABASE_URL`, `STAGING_SUPABASE_PUBLISHABLE_KEY` and the two test users' emails and passwords.

## Step 5 — Vercel environment variables (owner)

Project `secondbrainsystem` → **Settings → Environment Variables**.

1. First check for existing `NEXT_PUBLIC_SUPABASE_*` variables and note which environments they apply to.
2. Add the three variables with **Production values, ticked for Production only**.
3. Add the three variables with **staging values, ticked for Preview only** (all branches).
4. Leave Development unset.
5. Never tick Preview on a variable that holds production values.

Order matters: the Production variables must exist **before** Phase 0.5 is merged to `main`. Otherwise the production build is refused (the current deployment stays live, so this is safe but blocks the release).

## Step 6 — Verify isolation (me, with you)

| Check | How | Expected |
|---|---|---|
| Fails safely without staging config | The first preview build of `feature/phase-0.5-staging`, pushed before Step 5 | Build **fails**: `Refusing to build: Missing … for the preview environment` |
| Preview is connected to staging | After Step 5, redeploy the branch preview; I open it in Chrome while you are signed in to Vercel | Amber `STAGING DATA · <staging-ref>` badge and `[Staging]` title. Network requests go only to `<staging-ref>.supabase.co`, never `rpjeqbbvocgwomiavxqh`. A production account cannot sign in; staging user A can. |
| Production untouched | GitHub/Vercel deployment records | Production remains on `fbc6cdb` until an approved merge |
| Permissions and read/write | `npm run staging:verify` (you run it, or ask me to — it reads `.env.staging.local` and never prints secrets) | All checks PASS: anonymous visitors see nothing; each user sees and changes only their own records; cross-account links rejected; test records archived afterwards |
| Schema parity | Query 7 on both projects | No differences (or each one explained and resolved on staging) |

Phase 1 begins only after every row passes.

## Ongoing rules

- New migrations: PGlite tests → `npm run staging:migrate -- --apply` → staging verification → owner approval → production.
- Write-testing happens only on deployments showing the STAGING DATA badge.
- Future import experiments (Notion, external calendars) use staging only, in labelled datasets.
