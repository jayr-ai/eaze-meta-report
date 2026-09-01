#!/usr/bin/env python3
# build_bookings.py — DATA-DRIVEN. Reads the raw calendar-events file (and opp pages, for
# contact-email test detection) and computes data["bookings"] deterministically. Unlike a human
# refresh, an unattended run can't pause to ask "who is this new user/calendar?" — so anything
# not in the maps below folds into a clearly-labeled "Other"/"calGeneral" bucket instead of being
# silently misattributed to a specific person. A WARN line prints so a human refresh later can
# add a genuinely new closer/calendar to the maps (see build_pipeline.py / build_daily.py USER).
#
# Usage: python3 build_bookings.py <calendar_events_file> <opp_page1> [<opp_page2> ...]
import json, os, sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))

USER = {  # keep in sync with build_pipeline.py / build_daily.py
    "KyR0lFZOC0l0GQHM6SLv": "Caleb",
    "zqTQ1FHgPWvS6H4g7520": "James",
    "rHJOq1QChy55u6ZfczJ1": "Matthew",
    "Z3WFuyTIWmoZMmzNJrRl": "Dan",
    "IF539f5WaTOw2WwPoo88": "Carlos",
}
CALENDAR = {  # calendarId -> bucket key
    "k5g6iNs4lD3WSYfjV4WJ": "calMedical",
    "k9lWJTolY1ViC9SAkZen": "calPrimary",
    "mou5qRUvM0dD5wXzO9xg": "calGeneral",
}
TEST_DOMAINS = ("tothemoondigital.com.au", "amala.agency", "eazeconsulting.com", "eazepay.com")


def _load(f):
    raw = open(f, encoding="utf-8").read()
    i = raw.find("{")
    return json.loads(raw[i:])


if len(sys.argv) < 3:
    print("ERROR: usage: build_bookings.py <calendar_events_file> <opp_page1> [<opp_page2> ...]")
    sys.exit(1)

events_file = sys.argv[1]
opp_files = sys.argv[2:]

ev = _load(events_file)["data"]["events"]

by_id = {}
for f in opp_files:
    d = _load(f)
    if "opportunities" in d:
        opps = d["opportunities"]
    elif isinstance(d.get("data"), dict):
        opps = d["data"].get("opportunities", [])
    else:
        opps = d.get("data", [])
    for o in opps:
        by_id[o["id"]] = o

contact_email = {}
for o in by_id.values():
    c = o.get("contact") or {}
    if c.get("id") and c.get("email"):
        contact_email[c["id"]] = c["email"].lower()


def is_test_event(e):
    email = contact_email.get(e.get("contactId"), "")
    title = (e.get("title") or "").lower()
    return (
        any(email.endswith(d) for d in TEST_DOMAINS)
        or "test" in title
        or "+test" in email
        or "+medtest" in email
    )


status = Counter(e["appointmentStatus"] for e in ev)
cal = Counter()
share = Counter()
unmapped_cal = set()
unmapped_user = set()
tests = 0
for e in ev:
    cid = e.get("calendarId")
    bucket = CALENDAR.get(cid)
    if bucket is None:
        bucket = "calGeneral"  # safe fallback: fold unrecognized/rare calendars into the misc bucket
        if cid:
            unmapped_cal.add(cid)
    cal[bucket] += 1

    uid = e.get("assignedUserId")
    nm = USER.get(uid)
    if nm is None:
        nm = "Other"  # safe fallback: never guess which named closer an unrecognized user is
        if uid:
            unmapped_user.add(uid)
    share[nm] += 1

    if is_test_event(e):
        tests += 1

total = len(ev)
real = total - tests

dp = os.path.join(HERE, "data.json")
data = json.load(open(dp))
data["bookings"] = {
    "total": str(total),
    "confirmed": str(status.get("confirmed", 0)),
    "noshow": str(status.get("noshow", 0)),
    "cancelled": str(status.get("cancelled", 0)),
    "showed": str(status.get("showed", 0)),
    "calMedical": str(cal.get("calMedical", 0)),
    "calPrimary": str(cal.get("calPrimary", 0)),
    "calGeneral": str(cal.get("calGeneral", 0)),
    "shareCaleb": str(share.get("Caleb", 0)),
    "shareJames": str(share.get("James", 0)),
    "shareMatthew": str(share.get("Matthew", 0)),
    "shareDan": str(share.get("Dan", 0)),
    "shareCarlos": str(share.get("Carlos", 0)),
    "shareOther": str(share.get("Other", 0)),
    "tests": str(tests),
    "real": str(real),
}
json.dump(data, open(dp, "w"), indent=2)
print(
    f"OK bookings. total={total} confirmed={status.get('confirmed', 0)} noshow={status.get('noshow', 0)} "
    f"cancelled={status.get('cancelled', 0)} showed={status.get('showed', 0)} tests={tests} real={real}"
)
if unmapped_cal:
    print(f"WARN: unrecognized calendarId(s) folded into calGeneral: {unmapped_cal}")
if unmapped_user:
    print(f"WARN: unrecognized assignedUserId(s) folded into Other: {unmapped_user}")
