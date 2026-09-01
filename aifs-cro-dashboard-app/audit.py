#!/usr/bin/env python3
# audit.py — the DAILY AUDIT that runs BEFORE the report is rendered.
# It reads the fully-assembled data.json and evaluates every remediation item and experiment
# against the LIVE state, so each one auto-flips open <-> done as the account actually changes.
# It writes data.json["audit"], whose status tags are injected into the fix + experiments panels
# as {%audit.tag.<id>%} tokens by render.js. Nothing about the format or copy is decided here,
# only STATUS + health. Deterministic, no LLM. Order in the daily run:
#   build_pipeline -> attr_build -> camp_econ -> build_daily -> AUDIT -> render.
import json, os, re
BASE = os.path.dirname(os.path.abspath(__file__)) + "/"
d = json.load(open(BASE + "data.json"))
def n(x): return int(re.sub(r"[^0-9]", "", str(x)) or 0)
p, b, r, at = d["pipeline"], d["bookings"], d["revenue"], d.get("attribution", {})
man = d.get("remediation", {})              # operator-set flags for config items the data can't see
def flag(k): return bool(man.get(k, False))

# ---- REMEDIATION PROGRAMME: id -> (priority, is-done condition) --------------------------
# auto = evaluated from data.json; manual = operator flips data.remediation[id] = true when done.
REMEDIATION = {
  # P0
  "p0_showed":       ("p0", lambda: n(b.get("showed")) >= max(5, round(n(b.get("total")) * 0.30))),
  "p0_optevent":     ("p0", lambda: flag("optEvent")),
  "p0_stamp":        ("p0", lambda: bool(r.get("stampRemediated")) or n(r.get("closesReal")) == n(p.get("closedWon")) and flag("stamp")),
  "p0_attr":         ("p0", lambda: any(int(c.get("won", 0)) > 0 for c in at.get("campaigns", []))),
  "p0_testbookings": ("p0", lambda: flag("testBookingsExcluded")),
  "p0_autoassign":   ("p0", lambda: n(p.get("ownerUnassigned")) <= round(n(p.get("totalCount")) * 0.10)),
  # P1
  "p1_pixel":        ("p1", lambda: flag("pixel")),
  "p1_utm":          ("p1", lambda: int(at.get("conventions", {}).get("distinct", 99)) <= 8),
  "p1_james":        ("p1", lambda: n(p.get("ownerJames")) <= 3),
  "p1_scale":        ("p1", lambda: flag("scale")),
  # P2
  "p2_archive":      ("p2", lambda: flag("archive")),
  "p2_probability":  ("p2", lambda: flag("probability")),
  "p2_calendars":    ("p2", lambda: n(b.get("calGeneral")) == 0 or flag("calendars")),
  "p2_tags":         ("p2", lambda: flag("tags")),
}
# ---- EXPERIMENTS: id -> is-done condition (reuse the same live signals) -------------------
EXPERIMENTS = {
  "exp01": lambda: n(b.get("showed")) >= max(5, round(n(b.get("total")) * 0.30)),   # Booked to Showed
  "exp02": lambda: bool(r.get("stampRemediated")),                                   # revenue truth (stamp) - RESOLVED
  "exp03": lambda: n(p.get("ownerUnassigned")) <= round(n(p.get("totalCount")) * 0.10),  # owner on entry
  "exp04": lambda: any(int(c.get("won", 0)) > 0 for c in at.get("campaigns", [])),   # click to opportunity attribution surfaced
  "exp05": lambda: flag("optEvent"),
  "exp06": lambda: flag("scale"),
  "exp07": lambda: flag("scale"),
  "exp08": lambda: flag("pixel"),
  "exp09": lambda: flag("optEvent"),
  "exp10": lambda: n(b.get("showed")) >= max(5, round(n(b.get("total")) * 0.30)),
  "exp11": lambda: n(b.get("showed")) >= max(5, round(n(b.get("total")) * 0.30)),
  "exp12": lambda: n(b.get("showed")) >= max(5, round(n(b.get("total")) * 0.30)),
  "exp13": lambda: n(p.get("callHeld")) >= 5,
  "exp14": lambda: n(p.get("ownerUnassigned")) <= round(n(p.get("totalCount")) * 0.10),
  "exp15": lambda: int(at.get("conventions", {}).get("distinct", 99)) <= 8,
}

def tag_rem(prio, done):
    return '<span class="tag done">DONE</span>' if done else f'<span class="tag {prio}">{prio.upper()}</span>'
def tag_exp(done):
    return '<span class="exp-fs" style="background:var(--ok-bg);color:#166534;border-color:#BBE6C8">done</span>' if done \
        else '<span class="exp-fs" style="background:var(--blue-bg);color:var(--blue-d)">open</span>'

tags, done_ct, openP0 = {}, 0, 0
for rid, (prio, cond) in REMEDIATION.items():
    done = bool(cond()); tags[rid] = tag_rem(prio, done)
    if done: done_ct += 1
    elif prio == "p0": openP0 += 1
for eid, cond in EXPERIMENTS.items():
    tags[eid] = tag_exp(bool(cond()))

total = len(REMEDIATION)
exp_done = sum(1 for c in EXPERIMENTS.values() if c())
d["audit"] = {
    "asOf": d.get("asOf", ""),
    "tag": tags,
    "total": str(total),
    "doneCount": str(done_ct),
    "openCount": str(total - done_ct),
    "openP0": str(openP0),
    "healthScore": f"{round(done_ct / total * 100)}%",
    "expTotal": str(len(EXPERIMENTS)),
    "expDone": str(exp_done),
    "summary": (f"Audited {d.get('asOf','')}: {done_ct} of {total} remediation items resolved "
                f"({round(done_ct/total*100)}% health), {openP0} P0 still open; "
                f"{exp_done} of {len(EXPERIMENTS)} experiments shipped. Re-audited every morning before the report."),
}
json.dump(d, open(BASE + "data.json", "w"), indent=2)
print(f"audit OK. remediation {done_ct}/{total} done ({d['audit']['healthScore']} health), "
      f"P0 open {openP0}, experiments {exp_done}/{len(EXPERIMENTS)} shipped")
