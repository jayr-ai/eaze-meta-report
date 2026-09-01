#!/usr/bin/env python3
# build_pipeline.py — DATA-DRIVEN. Reads the saved search-opportunity page files for
# pipeline PJbkfqE3g4KRP8i9ZeLb, dedupes by id, maps stage + owner IDs to names with the
# verified maps below, and writes pipeline counts + Closed-Won validation into data.json.
# Deterministic (no LLM mapping). Cash is never read from GHL (fake $10k stamp); only counts.
#
# Usage: python3 build_pipeline.py <opp_page1.json> [<opp_page2.json> ...]
import json, sys, os

HERE = os.path.dirname(os.path.abspath(__file__))
START = "2026-06-15"

STAGE = {
 "b9bfc681-76ef-4402-a7b8-428e39788582":"newUnworked",
 "910d1097-8955-4f62-9c79-eaafc3963a22":"contacted",
 "6bf502e8-54b7-4f8e-9ad6-d4e2cc79bbed":"contacted",  # "Contacted - No Answer", added to the GHL board 2026-07-19; folded into Contacted for now (not yet broken out as its own tracked stage)
 "a774b303-1cba-4279-b5d5-d06ae8eca597":"callBooked",
 "58b9e8fb-3e0f-4273-84d7-2a11c7bc0b59":"rescheduling",
 "8dec9a2c-863a-45d4-8495-f7dc8c17704b":"noShow",
 "fe83e23b-7a54-4906-95fd-3415a8824a32":"apptCancelled",
 "55f294c8-14a8-4734-83e3-9cb8d537c419":"callHeld",
 "a402364a-ad70-40af-b310-bfbce676ef45":"highPriority",
 "043f4a69-e187-481c-b43b-a7dd9ac34775":"closedWon",
 "a3bd42d8-305d-4307-aba7-b1da1658acbc":"longTermNurture",
 "368b91ca-95f0-48f8-89e2-6074426b983b":"lost",
}
USER = {  # verified against live user directory
 "KyR0lFZOC0l0GQHM6SLv":"Caleb",
 "zqTQ1FHgPWvS6H4g7520":"James",
 "rHJOq1QChy55u6ZfczJ1":"Matthew",
 "Z3WFuyTIWmoZMmzNJrRl":"Dan",
 "IF539f5WaTOw2WwPoo88":"Carlos",  # Carlos Fierro, joined 2026-07-11/12, confirmed 2026-07-13
}
def is_test(opp):
    c = opp.get("contact") or {}
    email = (c.get("email") or "").lower()
    name = (opp.get("name") or "").lower()
    return email.endswith("tothemoondigital.com.au") or "test" in name

# Operator-confirmed test/junk records that the automated email/name heuristics above don't
# catch (e.g. a $0 Closed-Won with a real-looking name and personal email). Excluded from every
# count on the dashboard, not just revenue. Add the opp id and a one-line reason when confirming
# a new one; never remove an id here without re-confirming with the team first.
EXCLUDED_OPP_IDS = {
    "zPuHwy8k9DqMpDjoszpZ",  # "Jayson Medina", $0 Closed-Won, no matching Stripe charge, confirmed test 2026-07-10
}

files = sys.argv[1:]
if not files:
    print("ERROR: no opportunity page files passed"); sys.exit(1)

def _load_opps(f):
    # robust to: raw MCP tool-result files (may have a preamble before the JSON) and
    # both response shapes -> {"opportunities":[...]} or {"data":{"opportunities":[...]}}.
    raw = open(f).read()
    i = raw.find("{")
    d = json.loads(raw[i:] if i >= 0 else raw)
    if isinstance(d.get("opportunities"), list):
        return d["opportunities"]
    dd = d.get("data")
    if isinstance(dd, dict) and isinstance(dd.get("opportunities"), list):
        return dd["opportunities"]
    if isinstance(dd, list):
        return dd
    raise ValueError(f"no opportunities array found in {f}")

by_id = {}
for f in files:
    for o in _load_opps(f):
        by_id[o["id"]] = o
opps = [o for o in by_id.values() if o["id"] not in EXCLUDED_OPP_IDS]
total = len(opps)
since = [o for o in opps if o["createdAt"] >= START]

from collections import Counter
# SNAPSHOT = current stock of the pipeline, EVERY opp, no created-date filter.
# This is exactly what the EAZE AI FUNDING SOLUTIONS board columns show.
st  = Counter(STAGE.get(o["pipelineStageId"], "other") for o in opps)
own = Counter(USER.get(o["assignedTo"], "unassigned") if o.get("assignedTo") else "unassigned" for o in opps)
won = [o for o in opps if STAGE.get(o["pipelineStageId"]) == "closedWon"]
won_real = [o for o in won if not is_test(o)]

dp = os.path.join(HERE, "data.json")
data = json.load(open(dp))
p = data["pipeline"]
p["sinceCount"] = str(len(since))
p["totalCount"] = str(total)
p["excluded"]   = str(total - len(since))
# full current snapshot, every stage (matches the board column-for-column)
p["newUnworked"]     = str(st.get("newUnworked", 0))
p["contacted"]       = str(st.get("contacted", 0))
p["callBooked"]      = str(st.get("callBooked", 0))
p["rescheduling"]    = str(st.get("rescheduling", 0))
p["noShow"]          = str(st.get("noShow", 0))
p["apptCancelled"]   = str(st.get("apptCancelled", 0))
p["callHeld"]        = str(st.get("callHeld", 0))
p["highPriority"]    = str(st.get("highPriority", 0))
p["closedWon"]       = str(st.get("closedWon", 0))
p["longTermNurture"] = str(st.get("longTermNurture", 0))
p["lost"]            = str(st.get("lost", 0))
p["ownerUnassigned"] = str(own.get("unassigned", 0))
p["ownerCaleb"]  = str(own.get("Caleb", 0))
p["ownerMatthew"]= str(own.get("Matthew", 0))
p["ownerDan"]    = str(own.get("Dan", 0))
p["ownerJames"]  = str(own.get("James", 0))
p["ownerCarlos"] = str(own.get("Carlos", 0))
# snapshot dict consumed by build_daily for the "Since campaign" window (board-exact)
data["pipelineSnapshot"] = {
    "newUnworked": st.get("newUnworked", 0), "contacted": st.get("contacted", 0),
    "callBooked": st.get("callBooked", 0), "rescheduling": st.get("rescheduling", 0),
    "noShow": st.get("noShow", 0), "apptCancelled": st.get("apptCancelled", 0),
    "callHeld": st.get("callHeld", 0), "highPriority": st.get("highPriority", 0),
    "closedWon": st.get("closedWon", 0), "longTermNurture": st.get("longTermNurture", 0),
    "lost": st.get("lost", 0), "total": total,
}
# keep the per-closer owned counts in the closers table in sync (full book)
for c in data.get("closers", []):
    nm = c["name"].split()[0]
    if nm in ("Caleb", "Matthew", "Dan", "James", "Carlos"):
        c["owned"] = str(own.get(nm, 0))
# revenue: real closes = non-test Closed-Won; NEVER touch the dollar figure
data["revenue"]["closesReal"] = str(len(won_real))
data["revenue"]["held"] = str(st.get("callHeld", 0))

# held + won bucketed by stage-change date (LA), so the window toggle can slice them
import datetime as _dt
from zoneinfo import ZoneInfo as _Z
_LA = _Z("America/Los_Angeles")
def _la(iso):
    try: return _dt.datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(_LA).date().isoformat()
    except Exception: return (iso or "")[:10]
heldByDate = Counter(); wonByDate = Counter()
for o in since:
    if STAGE.get(o["pipelineStageId"]) == "callHeld" and o.get("lastStageChangeAt"):
        heldByDate[_la(o["lastStageChangeAt"])] += 1
for o in won_real:
    if o.get("lastStageChangeAt"):
        wonByDate[_la(o["lastStageChangeAt"])] += 1
data["heldByDate"] = dict(heldByDate)
data["wonByDate"] = dict(wonByDate)

# ---- FULL pipeline funnel, every stage bucketed by the date the opp entered its current stage
# (lastStageChangeAt, LA). The window toggle slices this: Yesterday / Last 7 / Since campaign.
# This is the GHL source of truth (matches the EAZE AI FUNDING SOLUTIONS board), not the calendar.
from collections import defaultdict
flow = defaultdict(Counter)
for o in opps:  # ALL opps in the pipeline
    key = STAGE.get(o["pipelineStageId"])
    if key and o.get("lastStageChangeAt"):
        flow[key][_la(o["lastStageChangeAt"])] += 1
data["pipelineFlow"] = {k: dict(v) for k, v in flow.items()}
# stage display names, in board order
data["pipelineStageNames"] = {"newUnworked":"New - Unworked","contacted":"Contacted","callBooked":"Call Booked",
 "rescheduling":"Rescheduling","noShow":"No Show","apptCancelled":"Appt Cancelled","callHeld":"Call Held - WIP",
 "highPriority":"High Priority","closedWon":"Closed - Won","longTermNurture":"Long-Term Nurture","lost":"Lost"}

json.dump(data, open(dp, "w"), indent=2)
print(f"OK pipeline. total={total} since15={len(since)} callBooked={st.get('callBooked',0)} "
      f"newUnworked={st.get('newUnworked',0)} closedWon={st.get('closedWon',0)} real_won={len(won_real)} "
      f"owners(Caleb {own.get('Caleb',0)}/Matthew {own.get('Matthew',0)}/Dan {own.get('Dan',0)}/James {own.get('James',0)}/unassigned {own.get('unassigned',0)})")
if won_real and len(won_real) != int(data["revenue"]["closesReal"]):
    print("WARN closesReal mismatch")
