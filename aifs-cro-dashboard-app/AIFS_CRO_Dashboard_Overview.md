# AIFS CRO Dashboard — System Overview

Reference doc for the claude.ai Project. Written for someone (or a future Claude chat) with
zero prior context on this system.

## 1. What this is

The AIFS CRO Dashboard is a single-file static web app (`index.html`) that reports on AI Funding
Solutions' (AIFS) paid-media-to-revenue funnel: Meta Ads spend → GoHighLevel (GHL) sales pipeline
→ Stripe cash collected. It is NOT a live-connected app — it is rebuilt from scratch and
redeployed twice a day (6am / 3pm local, which is 5pm QLD) by an unattended scheduled task.

- Live URL: https://aifs-cro-dashboard-app-production.up.railway.app
- Hosting: Railway, workspace "JayR's Projects" (account jayveerespeto.ai@gmail.com), project
  `aifs-cro-dashboard-app`
- Meta ad account: 797173066166825 ("Eaze | Account 2")
- GHL location: `61bBcrk5Fi4BuTWwvW0P`; pipeline `PJbkfqE3g4KRP8i9ZeLb` ("EAZE AI FUNDING
  SOLUTIONS") is the ONLY GHL sales source of truth
- Stripe account: `acct_1TikBsANb4ghm41m` ("Ai Funding Solutions LLC")
- Business launch date / reporting window start: always 2026-06-15

## 2. People

- **James** — sets KPI/policy requirements (referenced as "DS Operating Guide Vol III" in this
  project; e.g. requested the Time-to-Booking metric). Also a GHL user in the closer round robin,
  but is the agency admin, not a seated closer — flagged for round-robin removal.
- **Caleb Chase, Carlos Fierro** — active closers.
- **Matthew Burns, Dan Baldasso** — no longer active as of 2026-07-10 (Dan) / earlier (Matthew);
  kept in code for historical booking counts, not live round robin.
- **Brodie, Gian** — leadership, own the DS Operating Guide (46-page official playbook this
  dashboard's rules are drawn from).

## 3. The non-negotiable rules (violate these and the build should fail, not silently ship)

1. **Gate 7 — revenue truth.** Cash always comes from Stripe, never from GHL's own stamped
   `monetaryValue`. A GHL "Closed-Won" pipeline STAGE does not by itself mean money changed
   hands — some are staged manually with no payment; some real closes sit at status `open` even
   in the Closed-Won stage (deposit-only deals). `won` (stage-based count) and `paidWon`
   (Stripe-matched count) are tracked separately and must never be conflated. `revenue.real` /
   `stripe.cash` are the only trustworthy cash figures.
2. **Same-pull consistency.** The daily view (`daily[]`) and the overall scoreboard totals are
   built from the exact same pull and must reconcile to the cent (spend within $0.20, all
   integer counts exact). `build_daily.py` enforces this as a hard gate — non-zero exit blocks
   deploy.
3. **Canonical campaign folding.** Meta spins up pixel-updated / relaunched / "copy" duplicates
   of the same 6 underlying campaign concepts constantly. Every build script folds raw
   campaign_ids through the SAME merge map into exactly 6 canonical campaigns (ids below) so the
   dashboard never fragments into dozens of near-duplicate rows.
4. **No em/en dashes anywhere in rendered output.** `render.js` hard-fails the build
   (`/[–—]/` check) if one slips through — raw GHL custom-field data sometimes contains them
   (e.g. "$250K–$500K") and must be cleaned before use.
5. **Meta's clock, not the local machine's clock, is ground truth** for "today"/"yesterday".
   The local shell clock has drifted from Meta's actual resolution by a day or more more than
   once. Always confirm via `date_preset:"yesterday"` before choosing a `time_range`.
6. **Never deploy or commit PII.** Raw GHL pulls (`opp_page*.json`, `calendar_events.json`)
   contain real names/emails/phones and are deleted after every refresh, never committed.

## 4. The 6 canonical campaigns

| Canonical name | ID | Objective |
|---|---|---|
| Aashish Medspa UGC Reels, CBO | 120248304846100411 | Appointment-optimised |
| Med Spa + Dental, ABO Broad | 120248175398410411 | Appointment-optimised |
| Warm Up | 120247947363680411 | Appointment-optimised |
| V3, Med Spa | 120246685751060411 | Appointment-optimised |
| RPF Dentists, WV Images | 120248020479770411 | Lead-optimised |
| RPF Derma, WV Images | 120248175348750411 | Lead-optimised |

The appt-optimised campaigns convert on Meta's "Website Schedule" event; the lead-optimised pair
converts on "Website Lead" — their cost-per-result is not comparable, which is why the dashboard
splits blended CPL into these two objective buckets ("Lead economics, by objective" panel) rather
than reporting one blended number.

## 5. Architecture: how a static HTML file stays "live"

`render.js` reads `data.json`, computes every derived number, and injects HTML wholesale into
marker-delimited regions of `index.template.html`
(`<!--SECTION_START--> ... <!--SECTION_END-->`), writing the result to `index.html`. Content
between markers in the template file is inert seed content, always fully overwritten — safe to
ignore. `{%dotted.path%}` tokens outside marker regions are filled from a flattened `data.json`
object; a missing token is a hard build error. Arrays are not flattened, so anything needing an
array lookup (e.g. `campaigns[2].ctr`) is computed as a `derived.*` token in render.js instead of
a template token.

Marker regions currently in use: OVERVIEW (CRO scoreboard), DAILY (drill down), ECON (unit
economics), PIPE (pipeline/closers), ATTR (attribution), CLOSERS, CAMPAIGNS (campaign
performance), CREATIVE (creative & fatigue).

## 6. The daily refresh pipeline (build scripts, run in this exact order)

1. **Meta pull** (agent-driven, not a script) — account totals, daily time_increment=1, campaign
   level, ad-set/ad level, opportunity score. Writes `meta_daily.json` and
   `data.json["meta"]`/`["campaigns"]`.
2. **GHL pull** (agent-driven) — `search-opportunity` paginated until the API's own `meta.total`
   count is reached, plus `get-calendar-events`.
3. **Stripe pull** (agent-driven) — charges, matched to GHL contacts by timestamp correlation
   (billing_details is redacted on this connector; charge `created` epoch, converted to LA time,
   is matched against the Closed-Won opportunity's `lastStageChangeAt` within ~10 seconds).
4. `build_pipeline.py` — pipeline stage snapshot, `pipelineSnapshot`, `revenue.closesReal`,
   `heldByDate`/`wonByDate`, `pipelineFlow`. Deterministic stage/owner-id → name maps, no LLM.
5. `attr_build.py` — UTM → campaign → Stripe cash join, writes `attribution.json`, merged into
   `data.json["attribution"]`. Matches paid sales by GHL contactId first, name as fallback.
6. `camp_econ.py` — merges attribution into `data["campaigns"]`, per-campaign CPL/CPA/ROAS,
   `campaignTotals`, blended `revenue.cpaReal`/`revenue.roas`. Also computes the appt-vs-lead
   objective split (`meta.apptSpend`/`leadSpend`/`cprAppt`/`cplRpf`).
7. `build_adcreative.py` — ad-set/ad level tables, winner/money-pit picks (>$50 spend floor),
   sub-$5 "sprawl" list. Feeds Campaign Performance + Creative & Fatigue tabs.
8. `build_ezcheck.py` — groups opportunities by RAW first-touch utm_campaign (deliberately NOT
   folded to the 6 canonical campaigns — the naming fragmentation itself is a finding), tags each
   by the contact's own `ezcheck prequalified`/`ezcheck unqualified` GHL tag. Feeds "EZ Check
   Pulls & Qualification Rate by Campaign".
9. `build_bookings.py` — `data.json["bookings"]` (total/confirmed/noshow/cancelled/showed,
   calendar buckets, per-closer shares). Unrecognized calendar/user IDs fold into a labeled
   "Other" bucket rather than being silently misattributed — a WARN prints so a human can add the
   mapping later.
10. `build_daily.py` — builds `daily[]` (one row per calendar day since launch) and `windows`
    (Yesterday/Last 7 days/Since launch aggregates), plus `timeToBooking`. **Hard reconciliation
    gate**: daily sums must match the overall totals already in `data.json`, or the script exits
    non-zero and the run stops — this is the "the two views can never disagree" guarantee.
11. `audit.py` — re-derives every remediation/experiment status against live data
    (`data["audit"]`), so status tags auto-flip open↔done as the account actually changes.
12. `node render.js` — fills every marker region and `{%token%}`. Non-zero exit on a missing
    token, missing marker, or an em/en dash anywhere in the output.

After that: a hygiene check (a fixed list of cross-field assertions — see `SKILL.md` STEP 6),
then Browser-preview verification, then `railway up --ci`, then polling the live URL for today's
date string before declaring success.

## 7. Time-to-Booking (added 2026-07-23)

Requested by James, citing DS Operating Guide Vol III §3. KPI: median days from when a demo is
booked (`dateAdded`) to the calendar day it's scheduled for (`startTime`) should stay ≤ 4 days —
short windows keep the "Fuel Cap" spend formula and calendar honest (spend should produce
conversations this week, not phantom bookings two weeks out). If the median creeps above 4-5
days, the booking window gets tightened again per capacity triggers. Bucketed by the day the
booking was CREATED (matching the existing `bookings` column's convention), computed in
`build_daily.py`, surfaced as a scorecard on the Overview tab and a per-day column on the Daily
Drill Down tab.

## 8. Known open items / soft spots (as of 2026-07-23)

- `bookings.shareOther` is ~21% (49 of 230) — some bookings fold into "Other" because the
  assigned user isn't in the closer map yet.
- `calGeneral` bucket is folding in 2 unrecognized calendar IDs.
- Conversion Funnel tab still has some stale narrative content (a single-sale case study, an
  outdated Closed-Won opportunity count) beyond the landing_page_view fix already applied.
- A new zero-spend "HVAC" campaign has appeared in Meta pulls; no numeric impact yet, but needs a
  proper name-pattern fold rule if it starts spending.

## 9. Where the automation actually runs

This entire pipeline is a scheduled task (`aifs-cro-daily-refresh`, cron `0 6,15 * * *`) inside
Claude Code on Jayvee's machine — NOT inside this claude.ai Project. This Project is a portable
knowledge snapshot for answering questions, planning changes, and onboarding people; it cannot
execute the scripts, call the Meta/GHL/Stripe connectors, or deploy. Treat it as documentation,
re-upload after major changes, and always make real changes in the actual Claude Code project.
