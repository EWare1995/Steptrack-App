# StepTrack independent STO production release gate

Status: **BLOCKED pending verified persistence/auth testing and authorized database migration**.
Branch: `feature/sto-goal-field-parity-20261028`; PR #8; Vercel project `steptrack-app`.
User has approved STO UI preview and requested preparation for production. This does **not** remove safety requirements.

## Confirmed
- [x] Vercel preview compiled and synthetic `/sto-preview` route loaded.
- [x] User accepted the visual/functional synthetic prototype.
- [x] Separate Free Supabase project created for isolated testing with synthetic rows only.
- [x] Simulated RLS tests: aide logging allowed; outsider cross-child access blocked; aide STO editing/delete denied; teacher/therapist editor permitted.
- [x] Multiple entries on one date count toward one qualifying date per STO.
- [x] Production table, column, foreign-key, and RLS metadata inspected read-only under explicit user authorization (no student rows).
- [x] Existing STO policy defect documented: member-based STO insert/update/delete RLS must be replaced before release.
- [x] Additive migration SQL drafted under `docs/sto-production-migration-REVIEW-DRAFT.sql`; not executed.

## Release gates — required before enabling feature
- [ ] Reconcile the isolated schema to StepTrack's actual production schema and auth/RPC dependencies without copying real student records.
- [ ] Run a reviewed migration in the isolated project with rollback and migration-history tracking. Compare resulting grants and policies.
- [ ] Use separate authenticated synthetic users to verify parent, teacher, therapist, aide, uninvited and unrelated-parent access through the real Supabase API.
- [ ] Connect a Vercel preview to the isolated project; keep preview environment variables separate from production.
- [ ] End-to-end test Create STO → Save → Live/manual trial logging → Refresh → STO-specific progress and no double counting.
- [ ] Regression test existing annual-goal logging, behavior reports, team invitations, owner permissions and legacy STO rows.
- [ ] Verify no real student data in testing and check production migration backup/recovery approach.
- [ ] Obtain explicit scoped authorization for production migration and activation, distinct from the still-unauthorized G1 security assessment.
- [ ] Apply migration in controlled sequence, verify schema/RLS, stage production build, smoke test, and release.
- [ ] Update consolidated security reviewer handoff with exact SQL, code paths, tests, versions, and residual risks.

## Hard stop
Do not merge PR #8, enable `NEXT_PUBLIC_STO_STORAGE_ENABLED`, run migration in production, or promote the feature until the above release-critical tests pass. A successful build or synthetic UI approval is not persistence/security verification.
