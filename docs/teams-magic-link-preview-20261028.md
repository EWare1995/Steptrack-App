# StepTrack Teams + invitation onboarding preview (October 28, 2026)

## User-visible changes

- Option A Teams screen: active team cards, effective permissions from membership rows, parent-only invite creator, personal display-name editing, mobile-friendly layout, manual invite-code fallback and guarded destructive actions.
- Email magic-link authentication for invited people, including first-time users. Clicking the email link signs them in and returns to the original student invitation.
- After successful verification, the existing \`accept_invite\` RPC attaches the user to the student, then the UI selects that student. The normal profile form is avoided when profile updates are permitted by the existing policies; default display name is "Team member" until the person edits it.
- Existing password sign-in and manual code join remain available.
- Parent invitation links use the current app origin so preview stays in preview and production stays in production.

## Scope / security boundaries

- **Preview only.** No release to main or production without owner review.
- No database migrations, RLS changes, SQL execution or G1 assessment. G1 remains unauthorized.
- Invitation authorization continues to depend on the existing server-side RPC, verified auth identity and memberships. A URL token, display profile, or selected account type alone is never authorization.
- This UI does not independently prove the RPC enforces single use, email matching, expiry or legal-parent ownership rules. Security reviewer should validate these claims against existing backend policies in an authorized review.
- No student data is placed in the magic-link email or sent to unverified visitors. Use synthetic students for preview testing.
- Parent role removal controls are intentionally withheld pending verified protected original-parent ownership rules.

## External settings that code cannot safely automate

1. In Supabase Authentication URL Configuration, allow this exact Vercel preview origin/redirect URL and relevant trusted production URL. If using dynamic preview hostnames, restrict wildcards to a trusted domain scope. Avoid permissive redirect wildcards.
2. Supabase magic-link emails are not automatically StepTrack-branded merely because the app UI is. To change the sender, configure a verified sending domain and authorized custom SMTP provider under Supabase Auth. Update and test the **Magic Link** email template using the provider's supported \`{{ .ConfirmationURL }}\` action URL, a recognizable StepTrack subject, sender and logo. Do not put student names or invite tokens in email copy.
3. Review Supabase Auth settings for sign-in-link rate limits, account signup policy and abuse monitoring. Verify the configured magic-link email redirect preserves the original invitation token and lands on the preview hostname.
4. To show durable invitation statuses, enable resend/revoke or list earlier invites, a separately reviewed backend method with owner-approved access controls is required. The preview **only** shows links created during the current screen session, clearly labeled as such.

## Owner acceptance checklist (synthetic data only)

- [ ] Parent creates teacher/therapist/aide invite links. Copy link and role persist until page refresh.
- [ ] New invited account: open link, request magic link for exactly invited email, open sign-in email; arrives in *correct* student portal with the proper role without an extra account confirmation/password/profile wizard.
- [ ] Existing account invited to a second student lands in the newly invited student's portal.
- [ ] Incorrect email, expired/invalid link, or signed-in wrong person cannot obtain access.
- [ ] Aide has no visible goal create/edit affordance and cannot access parent invite actions.
- [ ] Teacher/therapist privileges still follow existing parent-approved permissions.
- [ ] Parent sees correct active team membership list, can invite, and can revoke a nonparent collaborator as currently authorized.
- [ ] Desktop/mobile Teams layout usable and works with keyboard.
- [ ] Student data is not visible on an unauthenticated invite link.
- [ ] Reviewer signs off on access-flow changes; owner explicitly approves production deployment.
