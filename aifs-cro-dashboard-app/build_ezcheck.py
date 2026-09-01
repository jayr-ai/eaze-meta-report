#!/usr/bin/env python3
# build_ezcheck.py — DATA-DRIVEN. Reads the raw GHL search-opportunity page files, tags each
# opportunity's EZCheck screening result from its contact's tags ("ezcheck prequalified" /
# "ezcheck unqualified" — GHL's own screening-outcome tags, not re-derived from the individual
# Consumer/Merchant/BNPL custom fields), groups by the raw first-touch utm_campaign string (or
# the opportunity's own `source` field when no UTM was captured), and writes
# data.json["ezcheck"] for the "EZ Check Pulls & Qualification Rate by Campaign" panel.
# Deliberately does NOT fold to the 6 canonical campaign buckets: the naming fragmentation here
# (numeric ids, mixed casing, legacy source-only rows) is itself the finding the "one naming
# convention" panel on the Attribution tab already documents, so this panel shows it raw,
# only resolving bare numeric ids to a readable campaign name for legibility.
#
# Usage: python3 build_ezcheck.py <opp_page1.json> [<opp_page2.json> ...]
import json, sys, os, re
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))

CANONICAL_NAMES = {
    "120248304846100411": "Aashish Medspa UGC Reels, CBO",
    "120248175398410411": "Med Spa + Dental, ABO Broad",
    "120248020479770411": "RPF Dentists, WV Images",
    "120248175348750411": "RPF Derma, WV Images",
    "120247947363680411": "Warm Up",
    "120246685751060411": "V3, Med Spa",
}
MERGE = {"120248453390130411": "120248175398410411", "120248453007920411": "120248304846100411",
         "120246201060680411": "120248175398410411", "120246127614140411": "120248175398410411",
         "120246014332730411": "120248175398410411", "120248881907540411": "120248175398410411",
         "120248890453000411": "120248304846100411"}


def _load_opps(f):
    raw = open(f).read()
    i = raw.find("{")
    d = json.loads(raw[i:] if i >= 0 else raw)
    if isinstance(d.get("opportunities"), list):
        return d["opportunities"]
    dd = d.get("data")
    if isinstance(dd, dict) and isinstance(dd.get("opportunities"), list):
        return dd["opportunities"]
    return dd if isinstance(dd, list) else []


def label_for(cid):
    canon = MERGE.get(cid, cid)
    if canon in CANONICAL_NAMES:
        return f"{CANONICAL_NAMES[canon]} (numeric ID)"
    if re.match(r"^120241\d+$", cid):
        return "Pre-relaunch business (legacy numeric ID)"
    return None  # not a recognized numeric id -> not resolved, caller falls back to raw string


def group_key(o):
    attrs = o.get("attributions") or []
    first = attrs[0] if attrs else {}
    camp = (first.get("utmCampaign") or "").strip()
    if camp:
        if re.match(r"^\d{15,}$", camp):
            resolved = label_for(camp)
            return resolved if resolved else camp
        return camp  # readable name string, kept raw (casing/fragmentation is the finding)
    src = (o.get("source") or "").strip()
    return f"{src} (legacy, no UTM captured)" if src else "(no source captured)"


files = sys.argv[1:]
if not files:
    print("ERROR: no opportunity page files passed")
    sys.exit(1)

by_id = {}
for f in files:
    for o in _load_opps(f):
        by_id[o["id"]] = o
opps = list(by_id.values())

groups = defaultdict(lambda: Counter())
neither = 0
for o in opps:
    tags = set((o.get("contact") or {}).get("tags") or [])
    if "ezcheck prequalified" in tags:
        status = "pre"
    elif "ezcheck unqualified" in tags:
        status = "unq"
    else:
        neither += 1
        continue  # never pulled EZCheck at all -- excluded from qualification-rate denominator
    groups[group_key(o)][status] += 1

rows = []
for k, c in groups.items():
    total = c["pre"] + c["unq"]
    rows.append({"campaign": k, "prequalified": c["pre"], "unqualified": c["unq"], "total": total,
                 "qualRate": round(c["pre"] / total * 100, 1) if total else 0.0})
rows.sort(key=lambda r: -r["total"])

TOP_N = 9
top_rows = rows[:TOP_N]
rest = rows[TOP_N:]
rest_pre = sum(r["prequalified"] for r in rest)
rest_unq = sum(r["unqualified"] for r in rest)
rest_total = rest_pre + rest_unq
if rest:
    top_rows.append({
        "campaign": f"Everything else ({len(rest)} campaigns/sources, small samples)",
        "prequalified": rest_pre, "unqualified": rest_unq, "total": rest_total,
        "qualRate": round(rest_pre / rest_total * 100, 1) if rest_total else 0.0,
        "isOther": True,
    })

grand_pre = sum(r["prequalified"] for r in rows)
grand_unq = sum(r["unqualified"] for r in rows)
grand_total = grand_pre + grand_unq

d = json.load(open(os.path.join(HERE, "data.json")))
d["ezcheck"] = {
    "rows": top_rows,
    "overallPrequalified": grand_pre, "overallUnqualified": grand_unq, "overallTotal": grand_total,
    "overallQualRate": round(grand_pre / grand_total * 100, 1) if grand_total else 0.0,
    "neverPulled": neither, "totalOpps": len(opps),
    "groupCount": len(rows),
}
json.dump(d, open(os.path.join(HERE, "data.json"), "w"), indent=2)
print(f"OK ezcheck. {len(opps)} opps, {len(rows)} campaign/source groups, {neither} never EZCheck-pulled. "
      f"Overall {grand_pre}/{grand_total} = {d['ezcheck']['overallQualRate']}%")
