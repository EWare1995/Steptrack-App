# Isolated authenticated STO test — browser walkthrough

**This is not the production StepTrack application. No real student data.**

Preview route: `/sto-integration-test` on Vercel branch `feature/sto-goal-field-parity-20261028`.
The route has separate branch-scoped `NEXT_PUBLIC_STO_TEST_SUPABASE_URL` and `NEXT_PUBLIC_STO_TEST_SUPABASE_KEY` pointing only to Supabase `StepTrack-STO-Testing`. It is not wired to production credentials.

## What has actually been verified
- Vercel build READY at commit `64862bcd`.
- Preview route returns HTTP 200.
- Isolated RLS role impersonation and STO progress SQL tests passed with synthetic UUID claims.
- **No real email login or browser save/refresh test has been completed yet.**

## Before testing magic links
On the isolated Supabase project only, configure Auth URL redirect allowlist to contain the precise preview origin plus `/sto-integration-test`. Never change production Supabase Auth redirects for this test.
If the link opens a Vercel authentication screen, use the owner's Vercel session to access the protected preview. Do not disable deployment protection broadly.
If the link redirects to localhost or another destination, stop and correct the test project's Auth redirect allowlist before proceeding.

## Tester steps
1. Use a test-only email address (not a student/parent's personal information) and request an email sign-in link from the isolated test screen.
2. Follow the emailed link, ensure the browser returns to `/sto-integration-test`, and confirm signed-in email.
3. Select **Create synthetic student + 3/5 STO**. This creates a synthetic child, initial owner-parent membership, annual goal, and one STO in that order. It cannot create a membership in an unrelated child.
4. Select the STO, choose **Live X/O** or **Manual entry**, select date and supports, and save. No X/O sequence is stored, only success/total counts.
5. Press **Reload saved data**, then refresh the browser. Confirm the same entries and qualifying days remain.
6. Record 2/3 and 1/2 on the same date: should count exactly one 3/5 qualifying date. Record 2/5 on another date: should not qualify.
7. Sign out. Repeat with separately authorized teacher, therapist, aide and outsider accounts only after a controlled invitation/membership harness is added; currently this route does not implement team invitations or multi-role membership provisioning.

## Stop conditions
- Wrong Supabase project or unexpected child records: stop immediately; no writes.
- Auth redirects outside the allowlist: stop until corrected.
- Unexpected RLS/grant errors or missing records after refresh: do not merge/enable feature.
- Do not set the full application `NEXT_PUBLIC_STO_STORAGE_ENABLED=true` or change production Supabase env variables based solely on this targeted test route.
