# Database engine staging acceptance

The staging Supabase project `secondbrainsystem-staging` is a separate, non-production project.

All nine source-controlled migrations through `20261019190000_database_engine_foundation.sql` were applied to staging. Existing production data was not modified.

The feature branch has Preview-only, branch-scoped Vercel configuration for the staging Supabase URL and its public publishable key. It must never use production credentials in Preview.

Open `/database-lab` on the resulting Vercel Preview. Create or sign into a **new staging account** (production users are not automatically copied). Create Characters and Events databases, records, custom properties, values, and links. Refresh and sign in on another device to verify persistence. Verify user B cannot read user A's records before release.

This feature must not be merged to `main` while production's database-engine migration is not separately approved and applied. Frontend build/test success alone does not establish live backend acceptance.
