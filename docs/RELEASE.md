# Release and verification

1. Review docs/PRD-AUDIT.md and the additive migration.
2. Approve applying `20261014030325_thought_workspace.sql` to the shared live Supabase project. The branch preview currently shares production auth/data; there is no isolated Supabase branch configured. Do not apply without this approval.
3. Apply migration once with the Supabase migration mechanism. Check advisors, RLS and function grants, then exercise a disposable account. Existing calendar queries work before migration; thought capture remains disabled until schema loads.
4. Verify authenticated desktop and mobile flows A–G: capture/refresh, nested moves, collection conversion, typed properties, table/board consistency, backlinks, linked calendar edit from both surfaces, archive/restore, and second-user isolation. Reconfirm mobile full-screen navigation and calendar rendering against user references.
5. Keep changes on feature/pr11-ui-sidebar. Do not merge main. Only call the full implementation complete after authenticated UI checks, outstanding PRD scope and release approval are resolved.

Commands: npm ci; npm test; npm run typecheck; npm run lint; npm run build.

The database test uses an isolated embedded Postgres instance. It creates temporary roles/users in that instance; it never creates accounts or test rows in the live project.
