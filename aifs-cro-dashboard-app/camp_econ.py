#!/usr/bin/env python3
# camp_econ.py — reusable. Merges the attribution join (attribution.json: per-campaign opps/won/cash/roas)
# with the Meta campaign pull that the refresh agent has already written onto data.json["campaigns"]
# as [{name,id,spend,impressions,clicks,leads}], then computes ctr/cpc/cpl/cpa/roas/revenue per campaign,
# the campaignTotals row, and the blended revenue.cpaReal / revenue.roas for the Campaign-to-date headline.
# No hardcoded numbers. Run AFTER attr_build.py and AFTER the agent sets data["campaigns"] from Meta.
import json, re, os
BASE = os.path.dirname(os.path.abspath(__file__)) + "/"
d  = json.load(open(BASE + "data.json"))
at = d.get("attribution") or json.load(open(BASE + "attribution.json"))
def money(s): return float(re.sub(r"[^0-9.]", "", str(s)) or 0)
def inum(s):  return int(re.sub(r"[^0-9]", "", str(s)) or 0)

# attribution rows carry opps / booked / won / paidWon / cash / roas per campaign id.
# won = Closed-Won stage count (may include deals with no payment yet); paidWon = count that
# actually matched a Stripe charge. All dollar math (cpa/roas/revenue) must key off paidWon,
# never won, or an unpaid stage-only close would look like a real cost-per-acquisition (Gate 7).
byid = {c["id"]: c for c in at.get("campaigns", [])}
spend_sum = money(d["meta"]["spend"])
real_sales = len(d.get("realSales", []))  # actual Stripe-verified paid count, not stage count
stripe_cash = money(d["stripe"]["cash"])

camps = []
for c in d["campaigns"]:
    sp = money(c["spend"]); ld = inum(c.get("leads")) if str(c.get("leads")).lower() not in ("", "n/a", "none") else 0
    a = byid.get(c["id"], {})
    won = int(a.get("won", 0)); paidWon = int(a.get("paidWon", 0)); cash = money(a.get("cash", 0))
    camps.append({
        "name": c["name"], "id": c["id"], "spend": c["spend"],
        "impressions": c["impressions"], "clicks": c["clicks"],
        "ctr": f"{money(c['clicks'])/max(inum(c['impressions']),1)*100:.2f}%",
        "cpc": f"${sp/max(inum(c['clicks']),1):.2f}",
        "leads": str(ld) if ld else "n/a", "cpl": f"${sp/ld:,.2f}" if ld else "n/a",
        "opps": str(a.get("opps", 0)), "cpr": a.get("costPerOpp", "n/a"),
        "results": f"{a.get('opps',0)} opps",
        "cprGood": bool(c.get("cprGood", False)),
        "won": won, "cash": a.get("cash", "$0") if paidWon else "$0",
        "cpa": f"${sp/paidWon:,.2f}" if paidWon else "n/a",
        "roas": a.get("roas", "n/a") if paidWon else "n/a",
        "revenue": a.get("cash", "$0") if paidWon else "$0",
    })
d["campaigns"] = camps

ts = sum(money(c["spend"]) for c in camps); ti = sum(inum(c["impressions"]) for c in camps)
tc = sum(inum(c["clicks"]) for c in camps); tl = sum(int(c["leads"]) for c in camps if c["leads"] != "n/a")
topps = sum(int(c["opps"]) for c in camps)
d["campaignTotals"] = {
    "spend": f"${ts:,.2f}", "impressions": f"{ti:,}", "clicks": f"{tc:,}",
    "ctr": f"{tc/max(ti,1)*100:.2f}%", "cpc": f"${ts/max(tc,1):.2f}",
    "leads": str(tl), "cpl": f"${ts/tl:,.2f}" if tl else "n/a",
    "opps": str(topps), "results": f"{topps} opps", "cpr": "n/a",
    "cash": d["stripe"]["cash"], "roas": f"{stripe_cash/ts:.2f}x" if ts else "n/a",
    "cpa": f"${ts/real_sales:,.2f}" if real_sales else "n/a",
}
# blended economics for the Campaign-to-date headline (account spend basis)
d["revenue"]["cpaReal"] = f"${spend_sum/real_sales:,.2f}" if real_sales else "n/a"
d["revenue"]["roas"]    = f"{stripe_cash/spend_sum:.2f}x" if spend_sum else "n/a"

# Appt vs lead-optimised split (fixed business classification, not campaign-name-fragile).
# meta.cpl blends two Meta optimisation objectives with very different cost profiles;
# this splits it so each can be judged against its own baseline. Ids are the same
# 6 canonical campaigns attr_build.py's CAMP_ORDER uses.
LEAD_OPT_IDS = {"120248175348750411", "120248020479770411"}   # RPF Derma, RPF Dentists -> Website Lead
APPT_OPT_IDS = {"120248304846100411", "120248175398410411",   # Aashish, Med Spa+Dental
                "120247947363680411", "120246685751060411"}   # Warm Up, V3            -> Website Schedule
def _leads_num(c): return int(c["leads"]) if c["leads"] != "n/a" else 0
lead_spend = sum(money(c["spend"]) for c in camps if c["id"] in LEAD_OPT_IDS)
lead_results = sum(_leads_num(c) for c in camps if c["id"] in LEAD_OPT_IDS)
appt_spend = sum(money(c["spend"]) for c in camps if c["id"] in APPT_OPT_IDS)
appt_results = sum(_leads_num(c) for c in camps if c["id"] in APPT_OPT_IDS)
d["meta"]["leadSpend"] = f"${lead_spend:,.2f}"
d["meta"]["leadResults"] = str(lead_results)
d["meta"]["apptSpend"] = f"${appt_spend:,.2f}"
d["meta"]["apptResults"] = str(appt_results)
d["meta"]["cplRpf"] = f"${lead_spend/lead_results:,.2f}" if lead_results else "n/a"
d["meta"]["cprAppt"] = f"${appt_spend/appt_results:,.2f}" if appt_results else "n/a"
d["meta"]["leadCampaignNames"] = " | ".join(c["name"] for c in camps if c["id"] in LEAD_OPT_IDS)
d["meta"]["apptCampaignNames"] = " | ".join(c["name"] for c in camps if c["id"] in APPT_OPT_IDS)
if lead_results + appt_results != tl:
    print(f"WARN camp_econ: appt+lead results {lead_results+appt_results} != total leads {tl} — a campaign id is missing from the split sets")
if abs(round(lead_spend + appt_spend, 2) - ts) > 0.02:
    print(f"WARN camp_econ: appt+lead spend {lead_spend+appt_spend:.2f} != total spend {ts:.2f} — a campaign id is missing from the split sets")

json.dump(d, open(BASE + "data.json", "w"), indent=2)
print(f"camp_econ OK. {len(camps)} campaigns, totals {d['campaignTotals']['spend']} "
      f"leads {d['campaignTotals']['leads']} roas {d['campaignTotals']['roas']} | "
      f"blended CPA {d['revenue']['cpaReal']} ROAS {d['revenue']['roas']} | "
      f"split appt {d['meta']['apptSpend']}/{d['meta']['apptResults']} lead {d['meta']['leadSpend']}/{d['meta']['leadResults']}")
