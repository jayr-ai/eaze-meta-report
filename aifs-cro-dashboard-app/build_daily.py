#!/usr/bin/env python3
# build_daily.py — DATA-DRIVEN. Reads Meta daily from meta_daily.json and GHL bookings
# (bucketed by created-date) from a saved calendar-events group file, builds the `daily`
# array in data.json, and reconciles the daily series against the OVERALL figures already
# in data.json (both come from the same 5am pull). Integers must match exactly; spend within
# a cent tolerance for Meta per-day rounding. Any mismatch exits non-zero so the task refuses
# to deploy misaligned views. This is the "both views can never disagree" gate.
#
# Usage: python3 build_daily.py <ghl_group_events_file.json>
import json, datetime, sys, os, re
from zoneinfo import ZoneInfo
from collections import Counter, defaultdict
from statistics import median as _stmedian

def _median(lst):
    return round(_stmedian(lst), 1) if lst else None

HERE = os.path.dirname(os.path.abspath(__file__))
LA = ZoneInfo("America/Los_Angeles")
START = "2026-06-15"   # fixed business launch date

def money(s):  # "$6,654.92" -> 6654.92
    return float(re.sub(r"[^0-9.]", "", str(s)))
def intof(s):  # "64,431" -> 64431
    return int(re.sub(r"[^0-9]", "", str(s)))

# ---- inputs ----
META = json.load(open(os.path.join(HERE, "meta_daily.json")))
EVENTS_FILE = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("GHL_EVENTS_FILE", "")

def la_date(iso):
    dt = datetime.datetime.fromisoformat(iso.replace("Z", "+00:00"))
    return dt.astimezone(LA).date().isoformat()

USER = {"KyR0lFZOC0l0GQHM6SLv":"Caleb","zqTQ1FHgPWvS6H4g7520":"James","rHJOq1QChy55u6ZfczJ1":"Matthew","Z3WFuyTIWmoZMmzNJrRl":"Dan","IF539f5WaTOw2WwPoo88":"Carlos"}
TODAY = datetime.datetime.now(LA).date().isoformat()
created = Counter(); total_events = 0; by_status = Counter(); pre_launch = 0
booked_by_user = Counter(); scheduled_today = 0; booked_today = 0
# outcome counters bucketed by the appointment's SCHEDULED day (startTime, LA), for windowed no-show / cancelled
sched_noshow = Counter(); sched_cancelled = Counter(); sched_showed = Counter()
# Time-to-booking: days between when the booking was CREATED (dateAdded) and the appointment's
# SCHEDULED day (startTime), bucketed by created-date to match the "bookings" column. Requested
# by James (DS Operating Guide Vol III): KPI is median <= 4 days; a creeping median is the signal
# that booking windows need tightening again. Negative values (scheduled before it was created,
# a data artifact) are excluded, not clamped to zero -- they are not a real lag to report.
ttb_by_day = defaultdict(list); ttb_all = []
if EVENTS_FILE and os.path.exists(EVENTS_FILE):
    ev = json.load(open(EVENTS_FILE))["data"]["events"]
    total_events = len(ev)
    for e in ev:
        st = e["appointmentStatus"]
        by_status[st] += 1
        booked_by_user[USER.get(e.get("assignedUserId"), "other")] += 1
        d = la_date(e["dateAdded"])
        sd = la_date(e["startTime"])
        ttb = (datetime.date.fromisoformat(sd) - datetime.date.fromisoformat(d)).days
        if d < START:
            pre_launch += 1
        else:
            created[d] += 1
            if ttb >= 0:
                ttb_by_day[d].append(ttb)
                ttb_all.append(ttb)
        if st == "noshow": sched_noshow[sd] += 1
        elif st == "cancelled": sched_cancelled[sd] += 1
        elif st == "showed": sched_showed[sd] += 1
        if d == TODAY:
            booked_today += 1
        if sd == TODAY:
            scheduled_today += 1
else:
    print("WARN: no GHL events file passed; bookings will be 0 and booking reconciliation skipped")

# ---- window: START..max(meta dates, booking dates) ----
meta_by_date = {m["date"]: m for m in META}
all_dates = set(meta_by_date) | set(created)
end = max(all_dates) if all_dates else START
start_d = datetime.date.fromisoformat(START)
end_d = datetime.date.fromisoformat(end)

daily = []
day = start_d
while day <= end_d:
    ds = day.isoformat()
    m = meta_by_date.get(ds)
    if m:
        _ld = m.get("lead", 0)
        row = {"date": ds, "spend": f"${m['spend']:,.2f}", "impressions": f"{m['impressions']:,}",
               "reach": f"{m['reach']:,}", "clicks": m["clicks"], "ctr": m["ctr"], "cpc": m["cpc"],
               "cpm": m["cpm"], "leads": _ld, "cpl": f"${m['spend']/_ld:,.2f}" if _ld else "n/a",
               "bookings": created.get(ds, 0), "ttbMedian": _median(ttb_by_day.get(ds, []))}
    else:
        row = {"date": ds, "spend": "$0.00", "impressions": "0", "reach": "0", "clicks": 0,
               "ctr": "0%", "cpc": "$0.00", "cpm": "$0.00", "leads": 0, "cpl": "n/a",
               "bookings": created.get(ds, 0), "ttbMedian": _median(ttb_by_day.get(ds, []))}
    daily.append(row)
    day += datetime.timedelta(days=1)

# ---- RECONCILE daily sums vs OVERALL in data.json (same-pull consistency) ----
dp = os.path.join(HERE, "data.json")
data = json.load(open(dp))
ov = data["meta"]; ob = data.get("bookings", {})

sum_spend  = round(sum(m["spend"] for m in META), 2)
sum_impr   = sum(m["impressions"] for m in META)
sum_clicks = sum(m["clicks"] for m in META)
sum_book   = sum(created.values())

errs = []
# spend: allow small per-day rounding drift; integers exact
if abs(sum_spend - money(ov["spend"])) > 0.20:
    errs.append(f"daily spend {sum_spend} vs overall {ov['spend']}")
if sum_impr != intof(ov["impressions"]):
    errs.append(f"daily impressions {sum_impr} vs overall {ov['impressions']}")
if sum_clicks != intof(ov["clicks"]):
    errs.append(f"daily clicks {sum_clicks} vs overall {ov['clicks']}")
if EVENTS_FILE and ob:
    if total_events != intof(ob.get("total", 0)):
        errs.append(f"events {total_events} vs overall bookings {ob.get('total')}")
    for k, sk in (("confirmed", "confirmed"), ("noshow", "noshow"), ("cancelled", "cancelled")):
        if intof(ob.get(sk, 0)) != by_status.get(k, 0):
            errs.append(f"status {k} {by_status.get(k,0)} vs overall {ob.get(sk)}")
    if sum_book + pre_launch != total_events:
        errs.append(f"created {sum_book}+pre {pre_launch} != events {total_events}")
if errs:
    print("RECONCILE FAIL (daily vs overall disagree):", "; ".join(errs)); sys.exit(1)

# ---- windowed aggregates (Yesterday / Last 7 days / Since launch), all from the same daily source ----
MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
def dlabel(iso):
    d = datetime.date.fromisoformat(iso); return f"{d.day} {MON[d.month-1]}"
def window(dateset, label, campaign_attributed_only=False):
    rows = [m for m in META if m["date"] in dateset]
    sp = round(sum(r["spend"] for r in rows), 2); im = sum(r["impressions"] for r in rows)
    cl = sum(r["clicks"] for r in rows); ld = sum(r.get("lead", 0) for r in rows)   # Meta lead events in window
    bk = sum(created.get(x, 0) for x in dateset)                 # booked = created in window (ties to spend)
    ns = sum(sched_noshow.get(x, 0) for x in dateset)            # no-shows on demos scheduled in window
    ca = sum(sched_cancelled.get(x, 0) for x in dateset)         # cancels on demos scheduled in window
    sh = sum(sched_showed.get(x, 0) for x in dateset)            # showed on demos scheduled in window (0 until recorded)
    # held + won bucketed by stage-change date (written by build_pipeline.py)
    hld = sum(data.get("heldByDate", {}).get(x, 0) for x in dateset)
    wn = sum(data.get("wonByDate", {}).get(x, 0) for x in dateset)
    show_rate = f"{(sh/(sh+ns)*100):.0f}%" if sh > 0 else "awaiting"   # needs showed recorded
    # close rate stays "awaiting" until attendance is recorded: won/held here compares different
    # opportunities (the won deal never passed through the Held stage), so any % would be misleading.
    close_rate = "awaiting"
    # revenue, from real (manual) sales closed in this window; n/a when no sale closed (revenue lags spend)
    # For narrow windows (Yesterday/Last 7 days), only count sales with a GHL contactId -- i.e.
    # sales actually attributable to this account's ad-funnel activity on that day. A real sale
    # with no contactId (e.g. an invoiced/Xero-linked payment unrelated to any GHL opportunity)
    # would otherwise get credited to whatever day it happened to land on, producing a nonsense
    # same-day ROAS against spend that had nothing to do with it. The "Since launch" cumulative
    # window intentionally does NOT apply this filter, so it matches the Campaign-to-date total.
    all_sales_in = [s for s in data.get("realSales", []) if s["date"] in dateset]
    sales_in = [s for s in all_sales_in if s.get("contactId")] if campaign_attributed_only else all_sales_in
    cash = sum(s["amount"] for s in sales_in); nsales = len(sales_in)
    # NOTE: reach is deliberately omitted, it is unique users and is NOT additive across days.
    return {"label": label, "days": len([d for d in dateset if d in meta_by_date]),
            "spend": f"${sp:,.2f}", "impressions": f"{im:,}", "clicks": f"{cl:,}",
            "ctr": f"{(cl/im*100):.2f}%" if im else "0%",
            "cpc": f"${(sp/cl):.2f}" if cl else "$0.00",
            "cpm": f"${(sp/im*1000):.2f}" if im else "$0.00",
            "leads": f"{ld:,}", "cpl": f"${(sp/ld):,.2f}" if ld else "n/a",
            "leadToBooking": f"{(bk/ld*100):.0f}%" if ld else "n/a",
            "bookings": bk, "noshow": ns, "cancelled": ca,
            "showed": sh, "showRate": show_rate, "held": hld, "closeRate": close_rate,
            "sales": nsales, "cash": f"${cash:,.0f}",
            "cpaSale": f"${(sp/nsales):,.2f}" if nsales else "n/a",
            "roas": f"{(cash/sp):.2f}x" if (sp and nsales) else "n/a"}
all_win = set(d["date"] for d in daily)              # full calendar 15 Jun..end
yday = max(meta_by_date)                              # last complete Meta day
yd = datetime.date.fromisoformat(yday)
last7 = set((yd - datetime.timedelta(days=i)).isoformat() for i in range(7)) & all_win
data["windows"] = {
    "yesterday":   window({yday}, dlabel(yday), campaign_attributed_only=True),
    "last7":       window(last7, f"last 7 days to {dlabel(yday)}", campaign_attributed_only=True),
    "sinceLaunch": window(all_win, f"since 15 Jun to {dlabel(yday)}"),
}

# ---- GHL PIPELINE FUNNEL (source of truth), windowed by the date each opp entered its stage ----
def pfunnel(start, end):
    F = data.get("pipelineFlow", {})
    def g(k): return sum(n for dt, n in F.get(k, {}).items() if start <= dt <= end)
    nu, co = g("newUnworked"), g("contacted")
    cb, ns, ca, rs = g("callBooked"), g("noShow"), g("apptCancelled"), g("rescheduling")
    hld, hp, cw, ltn, lo = g("callHeld"), g("highPriority"), g("closedWon"), g("longTermNurture"), g("lost")
    total = nu + co + cb + rs + ns + ca + hld + hp + cw + ltn + lo
    showed = hld + hp + cw                          # calls that clearly happened (held, hot, or won)
    dispo = showed + ns                             # calls with a show / no-show outcome recorded
    return {"pNew": nu, "pContacted": co, "pBooked": cb, "pReschedule": rs, "pNoShow": ns,
            "pCancelled": ca, "pHeld": hld, "pHighPri": hp, "pWon": cw, "pNurture": ltn,
            "pLost": lo, "pTotal": total, "pShowed": showed,
            "pShowRate": f"{(showed/dispo*100):.0f}%" if dispo > 0 else "awaiting",
            "pCloseRate": f"{(cw/showed*100):.0f}%" if showed > 0 else "awaiting"}
def psnapshot():
    # "Since campaign" = the CURRENT pipeline stock, every stage, matching the board exactly.
    S = data.get("pipelineSnapshot", {})
    nu, co = S.get("newUnworked",0), S.get("contacted",0)
    cb, rs = S.get("callBooked",0), S.get("rescheduling",0)
    ns, ca = S.get("noShow",0), S.get("apptCancelled",0)
    hld, hp, cw = S.get("callHeld",0), S.get("highPriority",0), S.get("closedWon",0)
    ltn, lo = S.get("longTermNurture",0), S.get("lost",0)
    total = S.get("total", nu+co+cb+rs+ns+ca+hld+hp+cw+ltn+lo)
    showed = hld + hp + cw
    dispo = showed + ns
    return {"pNew": nu, "pContacted": co, "pBooked": cb, "pReschedule": rs, "pNoShow": ns,
            "pCancelled": ca, "pHeld": hld, "pHighPri": hp, "pWon": cw, "pNurture": ltn,
            "pLost": lo, "pTotal": total, "pShowed": showed,
            "pShowRate": f"{(showed/dispo*100):.0f}%" if dispo > 0 else "awaiting",
            "pCloseRate": f"{(cw/showed*100):.0f}%" if showed > 0 else "awaiting"}
_yd = datetime.date.fromisoformat(TODAY) - datetime.timedelta(days=1)   # yesterday (calendar)
_l7 = datetime.date.fromisoformat(TODAY) - datetime.timedelta(days=7)
data["windows"]["yesterday"].update(pfunnel(_yd.isoformat(), _yd.isoformat()))
data["windows"]["last7"].update(pfunnel(_l7.isoformat(), _yd.isoformat()))
data["windows"]["sinceLaunch"].update(psnapshot())   # board-exact stock, not flow

# ---- write ----
data["daily"] = daily
data["dailyMeta"] = {
    "bookingsSince15": sum_book,
    "bookingsPreLaunch": pre_launch,
    "bookingsTotal": sum_book + pre_launch,
    "spendCheck": f"${sum_spend:,.2f}",
    "clicksCheck": f"{sum_clicks:,}",
    "activeDays": len(META),
}
# Time-to-booking KPI (DS Operating Guide Vol III §3, requested by James): median days between
# a booking's creation and its scheduled appointment day. Target: median <= 4 days.
_ttb_median = _median(ttb_all)
data["timeToBooking"] = {
    "medianDays": _ttb_median,
    "meanDays": round(sum(ttb_all) / len(ttb_all), 1) if ttb_all else None,
    "count": len(ttb_all),
    "targetDays": 4,
    "status": "ok" if (_ttb_median is not None and _ttb_median <= 4) else ("warn" if _ttb_median is not None else "n/a"),
}
# keep per-closer BOOKED counts live from the events (owned is set by build_pipeline.py)
if EVENTS_FILE:
    for c in data.get("closers", []):
        nm = c["name"].split()[0]
        if nm in USER.values():
            c["booked"] = str(booked_by_user.get(nm, 0))
    data["today"] = {"date": TODAY, "booked": booked_today, "scheduled": scheduled_today}
# ---- unit economics (computable now vs awaiting Stripe) ----
def money(s): import re as _r; return float(_r.sub(r"[^0-9.]","",str(s)))
spend_num = money(data["meta"]["spend"]); book_num = int(data["bookings"]["total"])
leads_num = int(data["meta"].get("leadResults","0") or 0)
real_sales = len(data.get("realSales", [])); real_cash = data["revenue"]["real"]
data["unitEcon"] = {
    "spend": data["meta"]["spend"],
    "costPerBooking": f"${(spend_num/book_num):,.2f}" if book_num else "n/a",
    "costPerLead": f"${(spend_num/leads_num):,.2f}" if leads_num else "n/a",
    "cpaReal": f"${(spend_num/real_sales):,.2f}" if real_sales else "n/a",
    "realSales": str(real_sales),
    "realCash": real_cash,
    "roas": data["revenue"]["roas"],
}
# keep revenue.cpaReal (shown in the funnel + leaks) in sync with spend so it can never drift
if real_sales:
    data["revenue"]["cpaReal"] = f"${(spend_num/real_sales):,.2f}"
json.dump(data, open(dp, "w"), indent=2)
print(f"OK reconciled. rows={len(daily)} spend=${sum_spend:,.2f} clicks={sum_clicks} "
      f"bookings_since15={sum_book} pre_launch={pre_launch} total={sum_book+pre_launch}")
