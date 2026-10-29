# StepTrack STO isolated-backend verification — 2026-10-29

## Environment and scope
- Created a separate Supabase Free project **StepTrack-STO-Testing** (project ref `lipcypqpyznhjbhbfobz`, us-east-1).
- This is an **empty, synthetic-only isolated database**. No production data was copied, queried, or modified. No production SQL, migration, or Vercel production promotion occurred.
- Created a minimal schema mirroring the relevant *concepts*, not a complete copy of StepTrack's current production schema: `children`, `memberships`, `goals`, `sto_objectives`, `sto_trial_entries`.
- STO objective has nullable `qualifying_days`; trial entries enforce numeric bounds and database-level composite foreign keys for STO→goal→child consistency.
- Enabled RLS on all five test tables. `anon` has no grants. Authenticated users can read through child membership; assigned roles with `can_edit_goals` can edit STOs; members can insert logs attributed only to themselves. Entries currently have no UPDATE/DELETE grants.
- User identity was simulated using PostgreSQL's authenticated role and JWT subject claim with five **synthetic UUIDs**, not real Supabase Auth accounts. Tests are **SQL/RLS simulations**, not end-to-end browser authentication tests.

## Verified results (isolated database only)
| Check | Expected | Observed |
| --- | --- | --- |
| Aide sees assigned student's data | One child, one goal, two STOs | PASS: 1 / 1 / 2 |
| Uninvited account sees child data | None | PASS: zero |
| Parent on different child sees other child's STOs | None | PASS: other parent sees only one STO for own child |
| Aide inserts own STO log | Allowed | PASS: persisted 2/3 with verbal+visual supports |
| Aide edits STO | Blocked | PASS: zero rows updated |
| Teacher/therapist with goal-edit permission | Can edit STO | PASS: one row each (rolled back) |
| Unrelated parent edits child A STO | Blocked | PASS: zero rows updated |
| Outsider inserts child A STO log | Blocked | PASS: RLS error 42501 |
| Aide inserts log with mismatched child ID | Blocked | PASS: RLS error 42501 |
| Invalid success/total (6/5) | Rejected | PASS: constraint error 23514 |
| Same-day logs 2/3 + 1/2 | One 3/5 qualifying date | PASS |
| Another date 2/5 | Not qualifying | PASS |
| STO B's log | Does not advance STO A | PASS: STO A 1/8, STO B 1/3 |
| Supabase security advisor | No lints | PASS: zero findings |

## Application branch
- Draft PR #8 includes `lib/stoTrialProgress.js`, `components/StoTrialEntryPanel.js`, and guarded wiring in `components/Main.js`.
- Live STO storage functionality is OFF by default until `NEXT_PUBLIC_STO_STORAGE_ENABLED=true` is explicitly set **after** a reviewed migration in the target environment. The synthetic `/sto-preview` remains independently functional.
- Vercel preview compiled at commit `214a5e6`. This is compilation evidence, **not** proof of authenticated API persistence.

## Remaining release-critical work — NOT YET VERIFIED
1. Determine how the production tables and existing RLS actually differ from this minimal synthetic schema; G1 baseline capture remains separately **unauthorized**. No production schema inspection has taken place.
2. Produce a migration **matched to actual existing schema and RLS**, without deleting or overwriting historical data. Do not apply a migration made from guessed types.
3. Confirm granted rights for parent, teacher, therapist, aide, outsider, and anonymous using actual separate Supabase Auth sessions and client-side API, not only SQL claim emulation.
4. Verify true Next.js→Supabase→refresh persistence using a preview configured to point at an isolated schema-compatible database. The current synthetic DB does not contain all tables/RPCs expected by the full application.
5. Verify preservation of annual-goal logs, reports, historical STOs, timestamp interpretation, invitation flow and child isolation after migration.
6. Obtain scoped owner approval for production migration/promotion and honor review boundaries.

**Production release status:** NOT READY. The isolated RLS and calculation proof-of-concept passed, but it would be unsafe to represent these synthetic schema tests as a successful integration against live StepTrack.
