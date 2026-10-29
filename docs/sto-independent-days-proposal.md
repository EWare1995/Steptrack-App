# Independent STO qualifying days — design-review handoff

Status: **preview-only design proposal; no production schema, SQL, RLS, or data changes.**

## Owner decision

Each short-term objective (STO) has its own trial target and its own number of qualifying calendar days. STO criteria do not automatically inherit the annual goal's mastery-day count. An example annual goal may require 4/5 on 10 dates while STOs require 2/5 on 3 dates, 3/5 on 8 dates, and 4/5 on 8 dates.

## Front-end prototype

The route `/sto-preview` provides an isolated, synthetic-only demonstration of:
- Creating/editing STO target successes, total opportunities, individual qualifying days, baseline, direction, target date, and multiple supports.
- Live X/− trial entry and manual successful/total opportunity entry, explicitly attributed to one selected STO.
- A separate mastery progress indicator and qualifying-date history for each STO.
- Written target validation: 3/5 in the objective must match 3/5 structured; 'across 8 days' must match the configured 8 days.
- No backend calls, persistence, or authorization claims; synthetic data resets on refresh.

## Proposed backend scope (not executed or approved)

1. Persist independent qualifying-day criteria on each STO with validation and audit handling.
2. Associate STO trial entries with an explicit STO identity; do not infer the STO from the annual goal alone.
3. Preserve existing annual-goal trial logging behavior and historical records. Define carefully whether an STO entry can also contribute to an annual goal, with no accidental double counting.
4. Enforce membership and role permissions on every STO entry read/write, including child/STO consistency, the aide's current logging permissions, and existing past-day editing restrictions.
5. Count one qualifying day per *calendar date and STO*, aggregating entries for the same STO/date. A date qualifies only when total opportunities reach at least that STO's denominator and the day's observed success ratio meets the STO's direction and target ratio.
6. Show legacy STOs without qualifying-day configuration as not yet configured rather than inferring mastery.
7. Review data retention, audit trails, and whether the new association changes any existing report queries.

## Acceptance criteria for an authorized future implementation

- A 3/5 STO across 8 distinct days shows 5/8 when exactly five different dates qualify.
- Two entries on one date may aggregate to 3/5 but count as **one** date.
- Recording for STO A does not advance STO B.
- Changing an STO target updates calculated progress consistently without mutating historical entries.
- Incorrect/negative/fractional counts, impossible ratios, or mismatches between written and structured criteria are rejected.
- Parent/teacher/therapist/aide role permissions and child isolation continue to hold server-side; tests use separate synthetic accounts.
- Full persistence survives refresh only after reviewed backend implementation.

## Security boundary

G0 planning is closed. G1 production-baseline capture remains separately unauthorized. This document does **not** authorize executing SQL, migrations, production database inspection, account changes, RLS edits, or assessment tests. Coordinate a separately scoped review and owner approval before any backend implementation.
