# data.json — Field Glossary (PII-free)

`data.json` is the single source of truth `render.js` reads from. This doc describes every
top-level key, what writes it, and its shape — with names/emails/amounts replaced by
placeholders. Do not upload the live `data.json` itself to any external tool; it contains real
buyer names and contact IDs in `realSales`, `saleAttribution`, and `saleDemographics`.

| Key | Written by | Shape / purpose |
|---|---|---|
| `asOf`, `windowMeta`, `windowGhl`, `windowDays` | refresh agent (STEP 4) | Report date and the Meta/GHL reporting windows as display strings |
| `meta` | refresh agent + `camp_econ.py` | Account-level Meta totals: spend, impressions, reach, clicks, ctr, cpc, cpm, leads, cpl, oppScore, landingPageViews, last7 sub-object, appt/lead objective split (apptSpend/apptResults/cprAppt, leadSpend/leadResults/cplRpf) |
| `campaigns` | refresh agent + `camp_econ.py` | Array of the 6 canonical campaigns: `{id, name, spend, impressions, clicks, ctr, cpc, leads, cpl, cprGood, opps, won, cash, roas, cpa}` |
| `campaignTotals` | `camp_econ.py` | Summed row across the 6 campaigns |
| `campaignNote` | refresh agent | Free-text note surfaced under the scorecard table |
| `bookings` | `build_bookings.py` | `{total, confirmed, noshow, cancelled, showed, calMedical, calPrimary, calGeneral, shareCaleb, shareJames, shareMatthew, shareDan, shareCarlos, shareOther, tests, real}` — demo-calendar counts |
| `pipeline` | `build_pipeline.py` | GHL pipeline stage snapshot: 11 stage counts (newUnworked...lost), totalCount, sinceCount, excluded, 6 owner counts |
| `pipelineSnapshot` | `build_pipeline.py` | Same shape as `pipeline`, board-exact current stock (no createdAt filter) |
| `pipelineFlow` | `build_pipeline.py` | Per-stage counts bucketed by the date each opp entered that stage — powers windowed funnel views |
| `pipelineStageNames` | `build_pipeline.py` | Stage-id → display-name map |
| `heldByDate`, `wonByDate` | `build_pipeline.py` | Held/Won counts bucketed by stage-change date |
| `revenue` | `build_pipeline.py` + `camp_econ.py` | `{real, fake, realSaleName, realSaleOpp, realSaleContact, realSaleCampaign, cpaReal, roas, held, closesReal, stampRemediated}` — `real`/Stripe-verified vs `closesReal`/stage-based count, see Gate 7 |
| `stripe` | refresh agent (STEP 3) | `{account, cash, sales, aov, ltv, refundRate, refunds, disputes, lastSale, verified}` |
| `realSales` | refresh agent (STEP 3) | **Contains PII.** One entry per Stripe-verified sale: `{date, amount, name, contactId, stripe}` |
| `saleAttribution` | refresh agent (STEP 3c) | **Contains PII.** Per-sale campaign/adset/ad/source/device/touch-path trace |
| `saleDemographics` | refresh agent (STEP 3d) | **Contains PII (business-level).** Per-sale industry/monthly-revenue/lead-source/region/credit-score/pre-qualified — explicitly NOT age/gender (not available anywhere in this pipeline; see Overview doc §3) |
| `closers` | refresh agent + `build_daily.py` | Per-closer `{name, booked, owned, closed, cash, cashGood}` |
| `attribution` | `attr_build.py` (as `attribution.json`, merged in) | `{buckets: {mapped, preRelaunch, unmapped, unattributed}, totalOpps, ...}` — UTM/campaign coverage stats |
| `adsets`, `ads` | `build_adcreative.py` | Per-adset/ad rows with spend/clicks/ctr/cpc/leads/objective tag |
| `adCreative` | `build_adcreative.py` | Top-5 tables, winner/money-pit picks, sub-$5 sprawl list |
| `ezcheck` | `build_ezcheck.py` | `{rows: [{campaign, prequalified, unqualified, total, qualRate}], overallPrequalified, overallUnqualified, overallTotal, overallQualRate, neverPulled, totalOpps, groupCount}` |
| `daily` | `build_daily.py` | Array, one row per calendar day since 2026-06-15: `{date, spend, impressions, reach, clicks, ctr, cpc, cpm, leads, cpl, bookings, ttbMedian}` |
| `dailyMeta` | `build_daily.py` | `{bookingsSince15, bookingsPreLaunch, bookingsTotal, spendCheck, clicksCheck, activeDays}` |
| `windows` | `build_daily.py` | `{yesterday, last7, sinceLaunch}`, each a full metrics bundle (spend/impressions/.../bookings/showRate/closeRate/sales/cash/roas + pipeline funnel fields) |
| `today` | `build_daily.py` | `{date, booked, scheduled}` — this morning's snapshot |
| `unitEcon` | `build_daily.py` | `{spend, costPerBooking, costPerLead, cpaReal, realSales, realCash, roas}` |
| `timeToBooking` | `build_daily.py` | `{medianDays, meanDays, count, targetDays, status}` — the Time-to-Booking KPI (added 2026-07-23), `status` is `"ok"` / `"warn"` / `"n/a"` |
| `remediation` | manually maintained + `audit.py` | List of remediation items with open/done status |
| `audit` | `audit.py` | Re-derived status tags for every remediation item and experiment, plus an overall health score |

## Notes for anyone extending this schema

- Every new metric should be computed in a Python build script and read into `render.js` as
  either a template token or a `derived.*` value — never hand-edit `index.html` directly, it is
  fully regenerated every run.
- Any new per-day metric should follow the `daily[]` convention: bucket by the date the
  underlying event was CREATED, not when it resolved, so it lines up with the existing
  `bookings` column.
- Any new field touching a real buyer's identity goes in `realSales`/`saleAttribution`/
  `saleDemographics` only, and must never be uploaded raw to an external tool.
