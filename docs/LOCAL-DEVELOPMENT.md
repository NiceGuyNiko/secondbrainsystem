# Local development and data isolation — Phase 0.5

The hosted Supabase project `rpjeqbbvocgwomiavxqh` is **production only**. A second hosted project is not available on the current plan, so development and database testing use **local Supabase** (Supabase CLI + Docker Desktop) on the developer's Windows machine. Production data, auth settings and schema are never touched by development work.

## Rules enforced in code

| Where | Allowed data | Otherwise |
|---|---|---|
| Production deployment (Vercel Production) | the production project only | build refused |
| Preview deployment (Vercel Preview) | a hosted non-production project only — **none exists yet**, so previews currently refuse to build | build refused |
| Local development (`npm run dev`, `npm run build`) | local Supabase (`http://127.0.0.1:<port>`) or a hosted staging project | build refused; production is never accepted |

- Missing, contradictory or secret-key configuration fails closed (`lib/environment.ts`, tests in `tests/environment.test.ts`). A misconfigured build fails; if one were served, it shows a configuration error and creates no database client.
- Non-production pages show an amber **LOCAL DATA · 127.0.0.1:54321** (or STAGING DATA) badge and a `[Local]` tab title, including the sign-in screen.
- Database scripts (`scripts/db.ts`, `scripts/db-verify.ts`) only ever run Supabase CLI commands against the **local** stack. They refuse to run if this folder is linked to the production project, or if `SUPABASE_DB_URL`, `DATABASE_URL`, `SUPABASE_PROJECT_ID` or `SUPABASE_PROJECT_REF` could redirect the CLI (`scripts/db-guard.ts`, tests in `tests/db-guard.test.ts`). No script in this repository pushes migrations to a hosted project.
- Local Supabase starts empty. Seeding is disabled; production data is never copied.

## Testing layers

1. **PGlite** (`npm test`): fast in-memory Postgres for migrations, triggers, RLS and engine logic.
2. **Local Supabase** (`npm run db:verify`): the real Supabase stack — Postgres, Auth, PostgREST, RLS, grants — with two throwaway users created by the script.
3. **Production**: only after the owner explicitly approves reviewed, additive migrations.

## Commands

| Command | Effect |
|---|---|
| `npm run db:start` | Start local Supabase. The first run downloads images and applies every migration in `supabase/migrations`. |
| `npm run db:env` | Write the local API URL and publishable key into `.env.local` (git-ignored). Keys are not printed. |
| `npm run dev` | Run the app against local data. |
| `npm run db:verify` | Permission and read/write checks against local Supabase. |
| `npm run db:migrate` | Apply new migration files to the running local database. |
| `npm run db:reset` | Rebuild the **local** database from migrations. Erases local data only. |
| `npm run db:status` / `npm run db:stop` | Show local URLs (including local Studio at `http://127.0.0.1:54323`) / stop the stack. |

Local services: database, auth, API, realtime (used by the calendar), Studio, and a local mail catcher at `http://127.0.0.1:54324` for sign-up and reset emails. Storage, edge functions and analytics are disabled in `supabase/config.toml` to save disk space.

## One-time setup (owner, step by step)

1. **Install Docker Desktop** (free for personal use) with the WSL 2 backend, and move its disk image to drive D (drive C has limited free space).
2. **Base schema:** the four earliest production migrations are not in the repository. They are retrieved through read-only queries (6a inventory with a sensitive-content scan, then 6b statements) and committed with their exact production version numbers.
3. `npm run db:start` → `npm run db:env` → `npm run db:verify`. All checks must pass.
4. Optional schema parity check: the read-only fingerprint query below, run in the production SQL Editor and in local Studio (`http://127.0.0.1:54323` → SQL Editor). Differences are resolved with reviewed migrations applied locally first.

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

## Vercel

- **Production** variables (Production environment only), required **before** Phase 0.5 is merged to `main`:
  `NEXT_PUBLIC_AAA_DATA_ENV=production`, `NEXT_PUBLIC_SUPABASE_URL=https://rpjeqbbvocgwomiavxqh.supabase.co`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<production publishable key>`.
  Without them the production build is refused and the current deployment stays live.
- **Preview**: leave unset. Previews fail closed until a hosted non-production project exists. They never fall back to production.
- If a hosted staging project becomes available later, set its three values for Preview only (`NEXT_PUBLIC_AAA_DATA_ENV=staging`). The environment rules already support it.

## Path to production

New migrations: PGlite tests → `npm run db:migrate` / `db:reset` locally → `npm run db:verify` → owner review and explicit approval → applied to production → production verification. All migrations are additive.
