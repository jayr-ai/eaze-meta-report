#!/usr/bin/env python3
# build_adcreative.py — DATA-DRIVEN. Reads raw Meta ad-set-level and ad-level pulls, folds each
# to its canonical campaign (same merge map as attr_build.py's to_id()/merge), classifies by
# objective (appt vs lead, same fixed split as camp_econ.py), and writes data.json["adsets"],
# data.json["ads"], data.json["adCreative"] (top-N tables + winners/sprawl summary) for the
# Campaign performance and Creative and fatigue tabs. Run after camp_econ.py (needs
# data.json["campaigns"] for canonical names) and before render.js.
#
# Usage: python3 build_adcreative.py <adsets_raw.json> <ads_raw.json>
import json, re, os, sys

BASE = os.path.dirname(os.path.abspath(__file__)) + "/"

CANONICAL = {"120248304846100411", "120248175398410411", "120248020479770411",
             "120248175348750411", "120247947363680411", "120246685751060411"}
MERGE = {"120248453390130411": "120248175398410411", "120248453007920411": "120248304846100411",
         "120246201060680411": "120248175398410411", "120246127614140411": "120248175398410411",
         "120246014332730411": "120248175398410411", "120248881907540411": "120248175398410411",
         "120248890453000411": "120248304846100411"}
LEAD_OPT_IDS = {"120248175348750411", "120248020479770411"}
APPT_OPT_IDS = {"120248304846100411", "120248175398410411", "120247947363680411", "120246685751060411"}


def canon(cid):
    if cid in CANONICAL:
        return cid
    return MERGE.get(cid, cid)


def objective(cid):
    c = canon(cid)
    if c in LEAD_OPT_IDS:
        return "lead"
    if c in APPT_OPT_IDS:
        return "appt"
    return "unknown"


def money(s):
    return float(re.sub(r"[^0-9.]", "", str(s)) or 0)


def inum(s):
    return int(re.sub(r"[^0-9]", "", str(s)) or 0)


def is_numeric_lead(v):
    return str(v).strip().lower() not in ("", "n/a", "none", "not available")


STATUS_LABEL = {
    "ACTIVE": "Active", "PAUSED": "Paused", "ADSET_PAUSED": "Paused",
    "CAMPAIGN_PAUSED": "Paused", "ARCHIVED": "Archived", "DELETED": "Deleted",
}


def load(path):
    return json.load(open(path))


if len(sys.argv) < 3:
    print("ERROR: usage: build_adcreative.py <adsets_raw.json> <ads_raw.json>")
    sys.exit(1)

raw_adsets = load(sys.argv[1])
raw_ads = load(sys.argv[2])

d = json.load(open(BASE + "data.json"))
camp_name = {c["id"]: c["name"] for c in d.get("campaigns", [])}


def fold_rows(raw):
    rows = []
    for r in raw:
        sp = money(r.get("amount_spent", 0))
        if sp <= 0:
            continue  # zero-spend legacy/inactive rows carry no signal
        cid = r["campaign_id"]
        cc = canon(cid)
        ld = r.get("lead")
        leads = inum(ld) if is_numeric_lead(ld) else None
        rows.append({
            "id": r["id"], "name": r["name"],
            "campaignId": cc, "campaignName": camp_name.get(cc, cc),
            "objective": objective(cid),
            "status": STATUS_LABEL.get(r.get("effective_status"), r.get("effective_status", "n/a")),
            "spend": sp, "clicks": inum(r.get("clicks", 0)),
            "ctr": r.get("ctr") if r.get("ctr") not in (None, "Not available") else "n/a",
            "cpc": r.get("cpc") if r.get("cpc") not in (None, "Not available") else "n/a",
            "leads": leads,
            "cpl": (sp / leads) if leads else None,
        })
    return rows

adsets = fold_rows(raw_adsets)
ads = fold_rows(raw_ads)

MIN_SPEND_FOR_RANKING = 50.0  # exclude thin-data noise from winner/money-pit ranking

def fmt_row(r, kind):
    return {
        "id": r["id"], "name": r["name"], "campaignName": r["campaignName"],
        "objective": r["objective"], "status": r["status"],
        "spend": f"${r['spend']:,.2f}", "clicks": f"{r['clicks']:,}",
        "ctr": r["ctr"], "cpc": r["cpc"],
        "results": f"{r['leads']} {'appts' if r['objective']=='appt' else 'leads'}" if r["leads"] else "0",
        "cpl": f"${r['cpl']:,.2f}" if r["cpl"] else "n/a",
    }

top_adsets = sorted(adsets, key=lambda r: -r["spend"])[:5]
top_ads = sorted(ads, key=lambda r: -r["spend"])[:5]

ranked = [r for r in ads if r["cpl"] and r["spend"] >= MIN_SPEND_FOR_RANKING]
winner_appt = min((r for r in ranked if r["objective"] == "appt"), key=lambda r: r["cpl"], default=None)
winner_lead = min((r for r in ranked if r["objective"] == "lead"), key=lambda r: r["cpl"], default=None)
money_pit = max((r for r in ranked if r["cpl"]), key=lambda r: r["cpl"], default=None)
zero_conv = [r for r in ads if r["leads"] is None and r["spend"] >= MIN_SPEND_FOR_RANKING]
zero_conv.sort(key=lambda r: -r["spend"])

SPRAWL_THRESHOLD = 5.0
sprawl = [r for r in ads if r["spend"] < SPRAWL_THRESHOLD]
sprawl_spend = sum(r["spend"] for r in sprawl)

d["adsets"] = [fmt_row(r, "adset") for r in adsets]
d["ads"] = [fmt_row(r, "ad") for r in ads]
d["adCreative"] = {
    "adsetCount": len(adsets), "adCount": len(ads),
    "topAdsets": [fmt_row(r, "adset") for r in top_adsets],
    "topAds": [fmt_row(r, "ad") for r in top_ads],
    "winnerAppt": fmt_row(winner_appt, "ad") if winner_appt else None,
    "winnerLead": fmt_row(winner_lead, "ad") if winner_lead else None,
    "moneyPit": fmt_row(money_pit, "ad") if money_pit else None,
    "zeroConvAds": [fmt_row(r, "ad") for r in zero_conv[:3]],
    "sprawlCount": len(sprawl), "sprawlSpend": f"${sprawl_spend:,.2f}",
    "sprawlThreshold": f"${SPRAWL_THRESHOLD:,.0f}",
}

json.dump(d, open(BASE + "data.json", "w"), indent=2)
print(f"OK adcreative. {len(adsets)} adsets, {len(ads)} ads (spend > $0) folded to "
      f"{len(camp_name)} canonical campaigns. sprawl {len(sprawl)} ads under {d['adCreative']['sprawlThreshold']} "
      f"(${sprawl_spend:,.2f} combined). winner appt: {winner_appt['name'] if winner_appt else 'n/a'} "
      f"| winner lead: {winner_lead['name'] if winner_lead else 'n/a'}")
