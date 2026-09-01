import json, re, os, sys, datetime
from collections import Counter, defaultdict
# Usage: python3 attr_build.py <opp_page1> <opp_page2> [...]
# Reads the raw GHL search-opportunity page files, writes attribution.json next to data.json.
BASE = os.path.dirname(os.path.abspath(__file__)) + "/"

# Revenue truth: a "won" opportunity only carries real cash if it matches an actual Stripe
# charge in data.json's realSales. Some Stripe charges (e.g. deposits) carry no billing name
# at all, only a contactId in metadata, so match by contactId FIRST and fall back to name.
# A Closed-Won STAGE does NOT by itself mean money changed hands (GHL can be staged manually
# with no payment, and some real closes sit at status "open" even in the Closed-Won stage, e.g.
# deposit-only deals) — Gate 7 forbids ever inventing revenue Stripe didn't verify. paidWon
# counts real-cash closes, separate from won (stage count, which still must equal
# pipeline.closedWon for that gate).
_real_sales = json.load(open(BASE + "data.json")).get("realSales", []) if os.path.exists(BASE + "data.json") else []
PAID_BY_NAME = {s["name"].strip().lower(): s["amount"] for s in _real_sales if s.get("name")}
PAID_BY_CONTACT = {s["contactId"]: s["amount"] for s in _real_sales if s.get("contactId")}

def paid_amount_for(o):
    cid = (o.get("contact") or {}).get("id")
    if cid and cid in PAID_BY_CONTACT:
        return PAID_BY_CONTACT[cid]
    nm = (o.get("name") or "").strip().lower()
    return PAID_BY_NAME.get(nm)

files = sys.argv[1:]
if not files:
    print("ERROR: pass the raw opportunity page files, e.g. python3 attr_build.py opp_page1.json opp_page2.json"); sys.exit(1)
def load(f):
    raw=open(f).read().strip(); i=raw.find('{'); return json.loads(raw[i:] if i>=0 else raw)
def opps(d): return d['opportunities'] if 'opportunities' in d else (d['data']['opportunities'] if isinstance(d.get('data'),dict) else d.get('data',[]))
# Operator-confirmed test/junk records excluded from every count (mirrors build_pipeline.py).
EXCLUDED_OPP_IDS = {
    "zPuHwy8k9DqMpDjoszpZ",  # "Jayson Medina", $0 Closed-Won, no matching Stripe charge, confirmed test 2026-07-10
}
allo={}
for f in files:
    for o in opps(load(f)): allo[o['id']]=o
opps=[o for o in allo.values() if o['id'] not in EXCLUDED_OPP_IDS]
def fa(o):
    a=o.get('attributions') or []; return a[0] if a else {}

STAGE={"b9bfc681-76ef-4402-a7b8-428e39788582":"newUnworked","910d1097-8955-4f62-9c79-eaafc3963a22":"contacted","6bf502e8-54b7-4f8e-9ad6-d4e2cc79bbed":"contacted","a774b303-1cba-4279-b5d5-d06ae8eca597":"callBooked","58b9e8fb-3e0f-4273-84d7-2a11c7bc0b59":"rescheduling","8dec9a2c-863a-45d4-8495-f7dc8c17704b":"noShow","fe83e23b-7a54-4906-95fd-3415a8824a32":"apptCancelled","55f294c8-14a8-4734-83e3-9cb8d537c419":"callHeld","a402364a-ad70-40af-b310-bfbce676ef45":"highPriority","043f4a69-e187-481c-b43b-a7dd9ac34775":"closedWon","a3bd42d8-305d-4307-aba7-b1da1658acbc":"longTermNurture","368b91ca-95f0-48f8-89e2-6074426b983b":"lost"}
BOOKED_PLUS={"callBooked","rescheduling","noShow","apptCancelled","callHeld","highPriority","closedWon"}

def to_id(v):
    if not v: return None
    if re.match(r'^\d{15,}$',v): return v
    s=v.lower()
    if "ugc reels" in s or "medspa ugc" in s: return "120248304846100411"
    if "derma" in s: return "120248175348750411"
    if "dentist" in s or ("rpf" in s and "wv" in s): return "120248020479770411"
    if "warm up" in s: return "120247947363680411"
    if s.startswith("v3") or "v3 |" in s: return "120246685751060411"
    if "med spa" in s or "medspa" in s or "dental" in s or "dynamic" in s: return "120248175398410411"
    return "__named__"

attr=defaultdict(lambda:{"opps":0,"booked":0,"won":0,"paidWon":0,"cash":0.0})
cov_utm=cov_fbc=0
src=Counter(); land=Counter(); distinct=set(); numeric=set(); named=set()
for o in opps:
    a=fa(o); st=STAGE.get(o['pipelineStageId'])
    raw=a.get('utmCampaign'); cid=to_id(raw)
    if raw:
        cov_utm+=1; distinct.add(raw)
        (numeric if re.match(r'^\d{15,}$',raw) else named).add(raw)
    if a.get('utmFbclid') or a.get('fbc'): cov_fbc+=1
    src[a.get('utmSource') or '(none)']+=1
    land[(a.get('url') or '(none)').replace('https://','').replace('http://','')]+=1
    if cid and re.match(r'^\d{15,}$',str(cid)):
        key="(pre-relaunch)" if str(cid).startswith("120241") else cid
    elif cid=="__named__": key="(unmapped)"
    else: key="(unattributed)"
    attr[key]["opps"]+=1
    if st in BOOKED_PLUS: attr[key]["booked"]+=1
    if st=="closedWon":
        attr[key]["won"]+=1
        amt=paid_amount_for(o)
        if amt is not None:
            attr[key]["paidWon"]+=1
            attr[key]["cash"]+=amt

# fold pixel-updated / relaunched / copy campaign variants' ATTRIBUTION (opps/won/cash) into
# their canonical parent. Spend/impr/clicks are NOT folded here, they come straight from
# data.json["campaigns"] below, already correctly folded by the day's Meta pull step.
merge={"120248453390130411":"120248175398410411","120248453007920411":"120248304846100411",
 "120246201060680411":"120248175398410411","120246127614140411":"120248175398410411","120246014332730411":"120248175398410411",
 "120248881907540411":"120248175398410411","120248890453000411":"120248304846100411"}
for dup,par in merge.items():
    if dup in attr:
        for k in ("opps","booked","won","paidWon","cash"): attr[par][k]+=attr[dup][k]
        del attr[dup]

CAMP_ORDER=["120248304846100411","120248175398410411","120248020479770411","120248175348750411","120247947363680411","120246685751060411"]
# Campaign spend/impr/clicks: read from data.json["campaigns"] (written by the Meta pull step,
# already folded to these 6 canonical rows). No hardcoded numbers to hand-edit each refresh.
def _money(s): return float(re.sub(r"[^0-9.]", "", str(s)) or 0)
def _int(s): return int(re.sub(r"[^0-9]", "", str(s)) or 0)
_data_campaigns = {c["id"]: c for c in json.load(open(BASE + "data.json")).get("campaigns", [])}
spend_by = {cid: _money(_data_campaigns[cid]["spend"]) for cid in CAMP_ORDER if cid in _data_campaigns}
impr_by  = {cid: _int(_data_campaigns[cid]["impressions"]) for cid in CAMP_ORDER if cid in _data_campaigns}
clk_by   = {cid: _int(_data_campaigns[cid]["clicks"]) for cid in CAMP_ORDER if cid in _data_campaigns}
name_by  = {cid: _data_campaigns[cid]["name"] for cid in CAMP_ORDER if cid in _data_campaigns}
camp_rows=[]
for cid in CAMP_ORDER:
    a=attr.get(cid,{"opps":0,"booked":0,"won":0,"paidWon":0,"cash":0.0}); sp=spend_by[cid]
    camp_rows.append({"id":cid,"name":name_by[cid],"spend":f"${sp:,.2f}","impr":f"{impr_by[cid]:,}","clicks":f"{clk_by[cid]:,}",
      "opps":a["opps"],"booked":a["booked"],"costPerOpp":f"${sp/a['opps']:,.2f}" if a["opps"] else "n/a",
      "won":a["won"],"paidWon":a.get("paidWon",0),
      "cash":f"${a['cash']:,.0f}" if a["cash"] else "$0",
      "roas":f"{a['cash']/sp:.2f}x" if sp and a.get("paidWon",0) else "n/a"})

buckets={"mapped":sum(attr[c]["opps"] for c in CAMP_ORDER if c in attr),
         "preRelaunch":attr.get("(pre-relaunch)",{}).get("opps",0),
         "unmapped":attr.get("(unmapped)",{}).get("opps",0),
         "unattributed":attr.get("(unattributed)",{}).get("opps",0)}
total_opps=len(opps)
# The proven click-to-cash trace must be an ACTUAL paid sale, never just "the first won stage
# opp" (a Closed-Won opp with no matching Stripe charge is not a real sale, see Gate 7). Stage
# is the source of truth here, not status: some real (deposit) closes sit at status "open"
# even while parked in the Closed-Won stage.
won_opps=[o for o in opps if STAGE.get(o['pipelineStageId'])=="closedWon"]
paid_opps=[o for o in won_opps if paid_amount_for(o) is not None]
won=paid_opps[0] if paid_opps else (won_opps[0] if won_opps else {})
won_cash=paid_amount_for(won) if won else None
wa=won.get('attributions') or []
first=wa[0] if wa else {}; last=wa[-1] if len(wa)>1 else first
sale_campaign_id=to_id(first.get('utmCampaign'))
sale_campaign_id=merge.get(sale_campaign_id, sale_campaign_id)
sale_campaign_name=name_by.get(sale_campaign_id, first.get('utmCampaign') or 'unattributed')

ATTR={"asOf":datetime.date.today().isoformat(),
 "coverageUtm":f"{cov_utm} of {total_opps}","coverageUtmPct":f"{round(cov_utm*100/total_opps)}%",
 "coverageFbc":f"{cov_fbc} of {total_opps}","coverageFbcPct":f"{round(cov_fbc*100/total_opps)}%",
 "sourceSplit":[{"k":k,"v":v} for k,v in src.most_common() if v>0],
 "landingTop":[{"k":k,"v":v} for k,v in land.most_common(6)],
 "campaigns":camp_rows,"buckets":buckets,"totalOpps":total_opps,
 "conventions":{"distinct":len(distinct),"numeric":len(numeric),"named":len(named)},
 "sale":{"name":won.get('name',''),"cash":(f"${won_cash:,.0f}" if won_cash else "n/a"),"campaign":sale_campaign_name,"campaignId":first.get('utmCampaign'),
   "source":first.get('utmSource'),"medium":first.get('utmMedium'),"referrer":first.get('referrer'),
   "firstTouch":(first.get('url') or ''),"lastTouch":(last.get('url') or ''),
   "content":first.get('utmContent'),"term":first.get('utmTerm'),
   "fbclid":((first.get('utmFbclid') or '')[:20]+"..."),"fbp":first.get('fbp'),"ip":first.get('ip'),
   "device":"iPhone, Instagram in-app browser"}}
json.dump(ATTR, open(BASE+"attribution.json","w"), indent=2)
print("OK attribution.json")
for r in camp_rows: print(f"  {r['name']:32} {r['spend']:>10} opps {r['opps']:>3} book+ {r['booked']:>3} won {r['won']} cash {r['cash']:>7} roas {r['roas']}")
print("buckets",buckets,"sum",sum(buckets.values()),"vs",total_opps)
print("coverage utm",ATTR['coverageUtmPct'],"fbc",ATTR['coverageFbcPct'],"| conventions",ATTR['conventions'])
print("sale:",ATTR['sale']['campaignId'],ATTR['sale']['source'],"|",ATTR['sale']['firstTouch'],"->",ATTR['sale']['lastTouch'])
