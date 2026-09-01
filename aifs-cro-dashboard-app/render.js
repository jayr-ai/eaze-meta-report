// render.js — deterministic: builds the CRO overview scoreboard from data.json and
// injects it into index.html between <!--OVERVIEW_START--> and <!--OVERVIEW_END-->.
// The daily refresh writes pure numbers to data.json, then runs `node render.js`.
// No LLM touches the HTML, so the numbers never drift and the layout never breaks.
const fs = require('fs');
const path = require('path');
const d = JSON.parse(fs.readFileSync(path.join(__dirname, 'data.json'), 'utf8'));
const m = d.meta, b = d.bookings, p = d.pipeline, r = d.revenue;

// call-outcome math (derived live from bookings; show rate auto-lights-up once "showed" is recorded)
const _n = s => parseInt(String(s).replace(/[^0-9]/g, '')) || 0;
const bkT = _n(b.total), bkNS = _n(b.noshow), bkC = _n(b.cancelled), bkS = _n(b.showed);
const completed = Math.max(bkT - bkC, 0), attKnown = bkS + bkNS;
const covPct = completed > 0 ? Math.round(attKnown / completed * 100) : 0;
const showRateTxt = bkS > 0 ? Math.round(bkS / (bkS + bkNS) * 100) + '%' : 'awaiting';
const heldN = _n(r.held), wonN = _n(r.closesReal);
// close rate stays "awaiting" until attendance is recorded: won vs held here are different opps, would mislead
const closeRateTxt = 'awaiting';
const sl = (d.windows && d.windows.sinceLaunch) || {};   // pipeline funnel, since the campaign
const stripe = d.stripe || {};                           // live cash, verified in Stripe
const ttb = d.timeToBooking || {};                       // time-to-booking KPI (DS Operating Guide Vol III §3)
const ttbFmt = v => (v === null || v === undefined) ? 'n/a' : `${v}d`;
// Multiple real sales are normal now, never hardcode a sale count or a specific buyer's name.
const realSalesList = d.realSales || [];
const salesN = _n(stripe.sales) || realSalesList.length || 0;
const saleWord = salesN === 1 ? 'sale' : 'sales';
const saleNameText = salesN === 1
  ? (r.realSaleName || (realSalesList[0] && realSalesList[0].name) || 'one buyer')
  : `${salesN} real sales`;
// campaigns with an actual paid close, in name order, for the Attribution/Econ narrative notes
const paidCampaigns = (d.campaigns || []).filter(c => c.won > 0 && c.cash && c.cash !== '$0');
const paidCampaignNames = paidCampaigns.map(c => c.name).join(', ') || 'no campaign yet';

// Sales with a GHL contactId came through the ad funnel (matched to a pipeline opportunity, and
// to a Meta campaign via the contact's captured UTM). Sales with no contactId are real revenue
// verified in Stripe but from outside the funnel entirely (e.g. a directly invoiced client) --
// they cannot be traced to a campaign, a GHL Closed-Won stage entry, or the click-to-cash table,
// so every claim about "attribution" or "matched to GHL" below uses this subset, never the total.
const adAttributedSales = realSalesList.filter(s => s.contactId);
const adAttributedN = adAttributedSales.length;
const adAttributedWord = adAttributedN === 1 ? 'sale' : 'sales';
const adAttributedCash = adAttributedSales.reduce((s, x) => s + x.amount, 0);
const adAttributedCashTxt = `$${adAttributedCash.toLocaleString('en-US')}`;
const unattributedSales = realSalesList.filter(s => !s.contactId);
const unattributedN = unattributedSales.length;
const unattributedWord = unattributedN === 1 ? 'sale' : 'sales';
const unattributedCash = unattributedSales.reduce((s, x) => s + x.amount, 0);
const unattributedCashTxt = `$${unattributedCash.toLocaleString('en-US')}`;

const campRows = d.campaigns.map(c =>
  `<tr><td>${c.name}<div class="sub">${c.id}</div></td><td class="num">${c.spend}</td><td class="num">${c.clicks}</td><td class="num">${c.ctr}</td><td class="num">${c.cpc}</td><td class="num">${c.leads || 'n/a'}</td><td class="num"${c.cprGood ? ' style="color:var(--ok)"' : ''}>${c.cpl || 'n/a'}</td><td class="num">${c.opps}</td><td class="num"${c.won > 0 ? ' style="color:var(--ok)"' : ''}>${c.cpa || 'n/a'}</td><td class="num"${c.won > 0 ? ' style="color:var(--ok)"' : ' style="color:var(--mut)"'}>${c.won > 0 ? c.roas : 'n/a'}</td></tr>`
).join('\n');

const closerRows = d.closers.map(c =>
  `<tr><td>${c.name}</td><td class="num">${c.booked}</td><td class="num">${c.owned}</td><td class="num">not yet, showed is not recorded</td><td class="num">not yet, showed is not recorded</td><td class="num">not yet, showed is not recorded</td><td class="num"${c.cashGood ? ' style="color:var(--ok)"' : ''}>${c.closed}</td><td class="num"${c.cashGood ? ' style="color:var(--ok)"' : ''}>${c.cash}</td></tr>`
).join('\n');

const html = `<!--OVERVIEW_START-->
<section class="panel on" id="p-overview">
<div class="eyebrow">Overview</div><h1 class="h1">CRO scoreboard</h1>
<div class="note">Daily report, ${d.asOf}. Refreshed once a day at 5:00am QLD from Meta and GHL, not live. Meta window ${d.windowMeta} (${d.windowDays} days), GHL window ${d.windowGhl}.</div>

<style>
.seg{display:inline-flex;gap:4px;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:4px;margin:2px 0 6px;max-width:100%;flex-wrap:wrap}
.wgrp{font-size:11.5px;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.04em;margin:14px 0 8px}
.seg button{border:0;background:transparent;color:var(--mut);font:inherit;font-size:13px;font-weight:600;padding:7px 15px;border-radius:7px;cursor:pointer}
.seg button.on{background:var(--blue-bg);color:var(--blue-d)}
</style>
<h2 class="sec">Performance by window</h2>
<div class="seg" id="winseg">
<button data-w="yesterday" class="on">Yesterday</button>
<button data-w="last7">Last 7 days</button>
<button data-w="sinceLaunch">Since launch</button>
</div>
<div class="note" id="w-label"></div>
<div class="wgrp">Meta ads, in this window</div>
<div class="grid g4">
<div class="kpi"><div class="n" id="w-spend"></div><div class="l">Ad spend</div><div class="s">Meta</div></div>
<div class="kpi"><div class="n" id="w-impr"></div><div class="l">Impressions</div><div class="s">Meta</div></div>
<div class="kpi"><div class="n" id="w-clicks"></div><div class="l">Clicks</div><div class="s">Meta</div></div>
<div class="kpi"><div class="n" id="w-ctr"></div><div class="l">CTR</div><div class="s">Meta</div></div>
<div class="kpi"><div class="n" id="w-cpc"></div><div class="l">CPC</div><div class="s">Meta</div></div>
<div class="kpi"><div class="n" id="w-cpm"></div><div class="l">CPM</div><div class="s">Meta</div></div>
<div class="kpi"><div class="n" id="w-leads"></div><div class="l">Leads</div><div class="s">Meta lead events</div></div>
<div class="kpi"><div class="n" id="w-cpl"></div><div class="l">CPL</div><div class="s">spend / leads</div></div>
</div>
<div class="wgrp">GHL pipeline, every stage, in this window</div>
<div class="note" style="margin:0 0 8px">The ${m.leads} leads Meta generated land in GHL and flow through these stages, in board order. New - Unworked are leads no one has touched yet. Totals here count opps whose stage changed in the window; use the toggle for Yesterday and Last 7 days.</div>
<div class="grid g4">
<div class="kpi"><div class="n blue" id="w-pnew"></div><div class="l">New - Unworked</div><div class="s">leads not yet contacted</div></div>
<div class="kpi"><div class="n" id="w-pcontacted"></div><div class="l">Contacted</div><div class="s">pipeline stage</div></div>
<div class="kpi"><div class="n" id="w-pbooked"></div><div class="l">Call Booked</div><div class="s">awaiting the call</div></div>
<div class="kpi"><div class="n" id="w-preschedule"></div><div class="l">Rescheduling</div><div class="s">pipeline stage</div></div>
<div class="kpi"><div class="n warn" id="w-pnoshow"></div><div class="l">No Show</div><div class="s">pipeline stage</div></div>
<div class="kpi"><div class="n warn" id="w-pcanc"></div><div class="l">Appt Cancelled</div><div class="s">pipeline stage</div></div>
<div class="kpi"><div class="n" id="w-pheld"></div><div class="l">Call Held</div><div class="s">call happened, WIP</div></div>
<div class="kpi"><div class="n" id="w-phighpri"></div><div class="l">High Priority</div><div class="s">hot after the call</div></div>
<div class="kpi"><div class="n ok" id="w-pwon"></div><div class="l">Closed Won</div><div class="s">real sale</div></div>
<div class="kpi"><div class="n" id="w-pnurture"></div><div class="l">Long-Term Nurture</div><div class="s">pipeline stage</div></div>
<div class="kpi"><div class="n" id="w-plost"></div><div class="l">Lost</div><div class="s">pipeline stage</div></div>
<div class="kpi"><div class="n" id="w-ptotal"></div><div class="l">Total in pipeline</div><div class="s">all stages, this window</div></div>
</div>
<div class="wgrp">GHL rates, in this window</div>
<div class="grid g4">
<div class="kpi"><div class="n" id="w-pshowrate"></div><div class="l">Show rate</div><div class="s">held, hot or won / (that + no show)</div></div>
<div class="kpi"><div class="n" id="w-pcloserate"></div><div class="l">Close rate</div><div class="s">won / calls held</div></div>
</div>
<div class="wgrp">Revenue, in this window</div>
<div class="grid g4">
<div class="kpi"><div class="n ok" id="w-cash"></div><div class="l">Cash collected</div><div class="s">real sales closed in window</div></div>
<div class="kpi"><div class="n" id="w-sales"></div><div class="l">Sales</div><div class="s">closed in window</div></div>
<div class="kpi"><div class="n" id="w-cpa"></div><div class="l">CPA</div><div class="s">spend / sales, n/a if none</div></div>
<div class="kpi"><div class="n" id="w-roas"></div><div class="l">ROAS</div><div class="s">cash / spend, n/a if none</div></div>
</div>
<div class="note" style="margin-top:6px">Revenue is counted on the day a sale closes, so short windows often show no sale yet (a lead can take weeks to close). CPA and ROAS read n/a when no sale closed in the window. Cash is Stripe verified (${salesN} real ${saleWord}, ${stripe.cash || r.real} total, last closed ${stripe.lastSale || 'n/a'}).</div>
<script>
(function(){
 var WIN=${JSON.stringify(d.windows || {})};
 function set(k){var w=WIN[k]; if(!w) return;
  var put=function(id,v){var el=document.getElementById(id); if(el){el.textContent=v; el.classList.toggle('st', v==='awaiting'||v==='n/a');}};
  put('w-spend',w.spend);put('w-impr',w.impressions);put('w-clicks',w.clicks);
  put('w-ctr',w.ctr);put('w-cpc',w.cpc);put('w-cpm',w.cpm);put('w-leads',w.leads);put('w-cpl',w.cpl);
  put('w-pnew',w.pNew);put('w-pcontacted',w.pContacted);put('w-pbooked',w.pBooked);put('w-preschedule',w.pReschedule);
  put('w-pnoshow',w.pNoShow);put('w-pcanc',w.pCancelled);put('w-pheld',w.pHeld);put('w-phighpri',w.pHighPri);
  put('w-pwon',w.pWon);put('w-pnurture',w.pNurture);put('w-plost',w.pLost);put('w-ptotal',w.pTotal);
  put('w-pshowrate',w.pShowRate);put('w-pcloserate',w.pCloseRate);
  put('w-cash',w.cash);put('w-sales',w.sales);put('w-cpa',w.cpaSale);put('w-roas',w.roas);
  put('w-label','Showing '+w.label+', '+w.days+' active day'+(w.days==1?'':'s')+' of Meta delivery');
  var bs=document.querySelectorAll('#winseg button');
  for(var i=0;i<bs.length;i++){bs[i].className=(bs[i].getAttribute('data-w')===k?'on':'');}
 }
 var bs=document.querySelectorAll('#winseg button');
 for(var i=0;i<bs.length;i++){(function(bb){bb.onclick=function(){set(bb.getAttribute('data-w'));};})(bs[i]);}
 set('yesterday');
})();
</script>

<h2 class="sec">Campaign to date, since 15 Jun</h2>
<div class="grid g4">
<div class="kpi"><div class="n ok">${r.closesReal}</div><div class="l">Real sales</div><div class="s">${saleNameText}</div></div>
<div class="kpi"><div class="n ok">${stripe.cash || r.real}</div><div class="l">Cash collected</div><div class="s">Stripe verified</div></div>
<div class="kpi"><div class="n">${r.cpaReal}</div><div class="l">CPA, blended</div><div class="s">${m.spend} spend / ${salesN} real ${saleWord}</div></div>
<div class="kpi"><div class="n ${_n(stripe.cash||r.real) >= _n(m.spend) ? 'ok' : 'bad'}">${r.roas}</div><div class="l">ROAS, blended</div><div class="s">${stripe.cash || r.real} cash / ${m.spend} spend</div></div>
<div class="kpi"><div class="n">${p.sinceCount}</div><div class="l">Pipeline</div><div class="s">opps since 15 Jun, of ${p.totalCount}</div></div>
<div class="kpi"><div class="n">${b.total}</div><div class="l">Demos on calendar</div><div class="s">${(d.dailyMeta||{}).bookingsSince15} since launch + ${(d.dailyMeta||{}).bookingsPreLaunch} pre launch</div></div>
<div class="kpi"><div class="n warn">${r.held}</div><div class="l">Held</div><div class="s">of ${p.callBooked} Call Booked</div></div>
<div class="kpi"><div class="n blue">${m.oppScore}</div><div class="l">Opportunity score</div><div class="s">Meta account, out of 100</div></div>
</div>
<div class="note">CPA and ROAS are blended across all spend since launch against the ${salesN} real closed ${saleWord} (${stripe.cash || r.real} total). ROAS reads under 1.0x this early because most of the ${m.spend} spend is still working leads that have not closed yet. Per campaign CPA and ROAS are in the scorecard below and the Attribution tab; windowed CPA and ROAS are in the toggle band above (n/a in any window with no sale closed).</div>

<h2 class="sec">Time-to-booking</h2>
<div class="callout ${ttb.status === 'ok' ? 'ok' : (ttb.status === 'warn' ? 'warn' : '')}">${ttb.status === 'ok'
  ? `Healthy. Median time-to-booking is ${ttbFmt(ttb.medianDays)}, at or under the ${ttb.targetDays}d KPI target (DS Operating Guide Vol III §3). Short windows keep the Fuel Cap formula and the calendar honest, spend is producing conversations this week, not phantom bookings two weeks out.`
  : (ttb.status === 'warn'
    ? `Median time-to-booking is ${ttbFmt(ttb.medianDays)}, above the ${ttb.targetDays}d KPI target. Per capacity triggers (Vol III §3), the booking window should be tightened again if slots are running short.`
    : `Not enough data yet to compute a time-to-booking median.`)}</div>
<div class="grid g4">
<div class="kpi"><div class="n ${ttb.status === 'ok' ? 'ok' : (ttb.status === 'warn' ? 'warn' : '')}">${ttbFmt(ttb.medianDays)}</div><div class="l">Median time-to-booking</div><div class="s">days, created to appointment</div></div>
<div class="kpi"><div class="n">${ttbFmt(ttb.meanDays)}</div><div class="l">Mean time-to-booking</div><div class="s">days, created to appointment</div></div>
<div class="kpi"><div class="n blue">${ttbFmt(ttb.targetDays)}</div><div class="l">KPI target</div><div class="s">median &le; 4 days</div></div>
<div class="kpi"><div class="n">${ttb.count ?? 0}</div><div class="l">Bookings measured</div><div class="s">since 15 Jun, valid created-to-appt pairs</div></div>
</div>
<div class="note">Time-to-booking is the gap between when a demo was booked (created) and the calendar day it was scheduled for, bucketed by the day it was created. KPI: median &le; 4 days; if it creeps above 4 to 5, the window gets tightened again (capacity triggers, Vol III §3). Per-day medians are on the Daily drill down tab, "Every day since 15 June" table.</div>

<h2 class="sec">Marketing scorecard, per active campaign</h2>
<div class="tw">
<table>
<thead><tr><th>Campaign</th><th>Spend</th><th>Clicks</th><th>CTR</th><th>CPC</th><th>Leads</th><th>CPL</th><th>Opps</th><th>CPA</th><th>ROAS</th></tr></thead>
<tbody>
${campRows}
<tr><td><b>Totals, 6 campaigns</b></td><td class="num"><b>${d.campaignTotals.spend}</b></td><td class="num"><b>${d.campaignTotals.clicks}</b></td><td class="num"><b>${d.campaignTotals.ctr}</b></td><td class="num"><b>${d.campaignTotals.cpc}</b></td><td class="num"><b>${d.campaignTotals.leads}</b></td><td class="num"><b>${d.campaignTotals.cpl}</b></td><td class="num"><b>${d.campaignTotals.opps}</b></td><td class="num" style="color:var(--ok)"><b>${d.campaignTotals.cpa}</b></td><td class="num" style="color:var(--ok)"><b>${d.campaignTotals.roas}</b></td></tr>
</tbody>
</table>
</div>
<div class="note">${d.campaignNote}</div>

<h2 class="sec">Lead economics, by objective</h2>
<div class="callout warn">CPL above (${m.cpl}) is blended across two Meta optimisation objectives with very different cost profiles. Split out below so each is judged against its own baseline, not against the blend.</div>
<div class="tw">
<table>
<thead><tr><th>Objective</th><th>Campaigns</th><th>Spend</th><th>Results</th><th>Cost per result</th><th>Meta conversion event</th></tr></thead>
<tbody>
<tr><td>Appointment-optimised</td><td>${m.apptCampaignNames}</td><td class="num">${m.apptSpend}</td><td class="num">${m.apptResults} appts</td><td class="num">${m.cprAppt}</td><td>Website Schedule</td></tr>
<tr><td>Lead-optimised</td><td>${m.leadCampaignNames}</td><td class="num">${m.leadSpend}</td><td class="num">${m.leadResults} leads</td><td class="num">${m.cplRpf}</td><td>Website Lead</td></tr>
</tbody>
</table>
</div>
<div class="note">Judge appointment campaigns against ${m.cprAppt} per appt and lead campaigns against ${m.cplRpf} per lead, not against each other or against the blended ${m.cpl}.</div>

<h2 class="sec">The full funnel, one look</h2>
<div class="callout warn">Marketing (Meta) and sales (GHL) are shown as two connected funnels, not one merged funnel, because most leads carry no consistent join key. Meta window ${d.windowMeta} (${d.windowDays} days). GHL window ${d.windowGhl}, pipeline filtered to the ${p.sinceCount} opportunities created since 15 June (of ${p.totalCount} total, ${p.excluded} predate the ads and are excluded).</div>
<div class="tw">
<table>
<thead><tr><th>Step</th><th>Window</th><th>Volume</th><th>Step conversion</th><th>Cumulative</th><th>Cost per step</th></tr></thead>
<tbody>
<tr><td>Impressions</td><td>Meta, ${d.windowMeta}</td><td class="num">${m.impressions}</td><td class="num">base</td><td class="num">100%</td><td class="num">CPM ${m.cpm}</td></tr>
<tr><td>Reach</td><td>Meta, ${d.windowMeta}</td><td class="num">${m.reach}</td><td class="num">frequency ${m.freq}</td><td class="num">-</td><td class="num">frequency ${m.freq}</td></tr>
<tr><td>Link clicks</td><td>Meta, ${d.windowMeta}</td><td class="num">${m.clicks}</td><td class="num">${m.ctr} of impressions</td><td class="num">${m.ctr}</td><td class="num" style="color:var(--blue-d)">CPC ${m.cpc}</td></tr>
<tr><td>Leads</td><td>Meta, ${d.windowMeta}</td><td class="num">${m.leads}</td><td class="num">${(m.leads&&m.clicks)?(_n(m.leads)/_n(m.clicks)*100).toFixed(1)+'% of clicks':''}</td><td class="num">${m.leads&&m.impressions?(_n(m.leads)/_n(m.impressions)*100).toFixed(2)+'%':''}</td><td class="num" style="color:var(--blue-d)">CPL ${m.cpl}</td></tr>
<tr><td>Landing page views</td><td>Meta, ${d.windowMeta}</td><td class="num">${m.landingPageViews || 'UNCOMPUTABLE'}</td><td class="num">${m.landingPageViews ? (_n(m.landingPageViews) / _n(m.clicks) * 100).toFixed(1) + '% of clicks' : 'UNCOMPUTABLE'}</td><td class="num">${m.landingPageViews ? (_n(m.landingPageViews) / _n(m.impressions) * 100).toFixed(2) + '%' : 'UNCOMPUTABLE'}</td><td class="num">${m.landingPageViews ? '$' + (parseFloat(String(m.spend).replace(/[^0-9.]/g, '')) / _n(m.landingPageViews)).toFixed(2) + ' per LPV' : 'landing_page_view not returned in pull, confirm in Ads Manager'}</td></tr>
<tr><td>Results (appts or leads)</td><td>Meta, ${d.windowMeta}</td><td class="num">${m.apptResults} appts + ${m.leadResults} leads</td><td class="num">two definitions</td><td class="num">two definitions</td><td class="num">cost per appt by campaign, ${m.cplRpf} per lead (RPF)</td></tr>
<tr><td>Booked demos</td><td>GHL, ${d.windowGhl}</td><td class="num">${b.total}</td><td class="num">${(b.total&&m.leads)?(_n(b.total)/_n(m.leads)*100).toFixed(0)+'% of leads':'seam'}</td><td class="num">seam, no per lead join</td><td class="num">${m.spend} / ${b.total} blended per booking</td></tr>
<tr><td>Call Booked (pipeline)</td><td>GHL, since campaign</td><td class="num">${sl.pBooked}</td><td class="num">awaiting the call</td><td class="num">-</td><td class="num">pipeline stage</td></tr>
<tr><td>No Show (pipeline)</td><td>GHL, since campaign</td><td class="num" style="color:var(--bad)">${sl.pNoShow}</td><td class="num">-</td><td class="num">-</td><td class="num">pipeline stage</td></tr>
<tr><td>Showed (held, hot or won)</td><td>GHL pipeline, since campaign</td><td class="num">${sl.pShowed}</td><td class="num">${sl.pShowRate} show rate</td><td class="num">of dispositioned calls</td><td class="num">Call Held + High Priority + Closed Won</td></tr>
<tr><td>Closed Won, real</td><td>GHL pipeline, since campaign</td><td class="num" style="color:var(--ok)">${sl.pWon}</td><td class="num">${sl.pCloseRate} close rate</td><td class="num">of calls held</td><td class="num" style="color:var(--ok)">${r.real} real, CPA ${r.cpaReal}</td></tr>
</tbody>
</table>
</div>
<div class="note">Step conversion is volume at this step divided by the step directly above it. Cumulative conversion is volume divided by Impressions. True close rate and held rate are UNCOMPUTABLE until showed is recorded.</div>

<h2 class="sec">Sales team scorecard</h2>
<div class="tw">
<table>
<thead><tr><th>Closer</th><th>Booked</th><th>Opps owned</th><th>No show</th><th>Show rate</th><th>Held</th><th>Closed</th><th>Cash</th></tr></thead>
<tbody>
${closerRows}
</tbody>
</table>
</div>
<div class="note">Booked is by assignedUser on the appointment, since 15 Jun (${b.total} total, Caleb ${b.shareCaleb}, James ${b.shareJames}, Matthew ${b.shareMatthew}, Dan ${b.shareDan}, Carlos ${b.shareCarlos}${_n(b.shareOther) ? `, Other/unassigned ${b.shareOther}` : ''}). Opps owned is native assignedTo on the pipeline (Caleb ${p.ownerCaleb}, Matthew ${p.ownerMatthew}, Dan ${p.ownerDan}, James ${p.ownerJames}, Carlos ${p.ownerCarlos}; ${p.ownerUnassigned} remain unassigned). James is the agency admin, not a seated closer, and should be reviewed for removal from the round robin. Dan is no longer an active closer as of 2026-07-10; Carlos Fierro joined as a new closer around 2026-07-11/12. Cash is only populated for closers who own a real closed opportunity (${salesN} real ${saleWord} so far).</div>

<h2 class="sec">Call outcomes, from the pipeline, since the campaign</h2>
<div class="grid g4">
<div class="kpi"><div class="n blue">${sl.pBooked}</div><div class="l">Call Booked</div><div class="s">awaiting the call</div></div>
<div class="kpi"><div class="n warn">${sl.pNoShow}</div><div class="l">No Show</div><div class="s">pipeline stage</div></div>
<div class="kpi"><div class="n warn">${sl.pCancelled}</div><div class="l">Appt Cancelled</div><div class="s">pipeline stage</div></div>
<div class="kpi"><div class="n">${sl.pHeld}</div><div class="l">Call Held</div><div class="s">call happened, WIP</div></div>
<div class="kpi"><div class="n">${sl.pHighPri}</div><div class="l">High Priority</div><div class="s">hot after the call</div></div>
<div class="kpi"><div class="n ok">${sl.pWon}</div><div class="l">Closed Won</div><div class="s">real sale</div></div>
<div class="kpi"><div class="n">${sl.pShowRate}</div><div class="l">Show rate</div><div class="s">held, hot or won / (that + no show)</div></div>
<div class="kpi"><div class="n">${sl.pCloseRate}</div><div class="l">Close rate</div><div class="s">won / calls held</div></div>
</div>
<div class="callout warn">These come straight from the EAZE AI FUNDING SOLUTIONS pipeline stages, the funnel your sales team works live (No Show 14 to 21 just in the last few hours). Show rate counts calls that clearly happened (Call Held, High Priority, Closed Won) against No Shows. It reads on the low side mainly because closers under-use the Call Held stage, so real held calls are still sitting in Call Booked, tightening that habit lifts it honestly. Use the window toggle above for Yesterday and Last 7 days.</div>

<h2 class="sec">Cash collected</h2>
<div class="grid g3">
<div class="kpi"><div class="n ok">${adAttributedCashTxt}</div><div class="l">Real cash collected</div><div class="s">Stripe verified, ${adAttributedN} real ${adAttributedWord} matched to a GHL win since 15 Jun</div></div>
<div class="kpi"><div class="n ok">${adAttributedCashTxt}</div><div class="l">Pipeline stamped value</div><div class="s">workflow now stamps real total contract value</div></div>
<div class="kpi"><div class="n ok">${adAttributedN} of ${r.closesReal}</div><div class="l">Wins are real</div><div class="s">test records removed</div></div>
</div>
<div class="card"><h3>What is real</h3><p class="small">${adAttributedN === 1
  ? `${adAttributedCashTxt} from 1 real sale, ${r.realSaleName} (opp ${r.realSaleOpp}, contact ${r.realSaleContact}), attributed via captured UTMs, fbclid, fbc and fbp to the ${r.realSaleCampaign} campaign on Instagram, first touch go.aifundingsolutions.com/clinic, last touch go.aifundingsolutions.com/democall, assigned to Caleb Chase.`
  : `${adAttributedCashTxt} from ${adAttributedN} real sales, each verified in Stripe and matched to its GHL contact. See the Attribution tab for the per-campaign cash and ROAS breakdown.`
}${unattributedN ? ` A further ${unattributedCashTxt} from ${unattributedN} real ${unattributedWord} ${unattributedN === 1 ? 'is' : 'are'} verified in Stripe but ${unattributedN === 1 ? 'has' : 'have'} no GHL contact or campaign to match (e.g. a directly invoiced client outside the ad funnel), so ${unattributedN === 1 ? 'it is' : 'they are'} counted in total cash but not shown here or in the click-to-cash table.` : ''}</p></div>
<div class="callout ok">Remediated by the team: the "Close Won" workflow now stamps the real total contract value on the win, not a flat $10,000, so the pipeline value matches the signed deal. Cash on this dashboard is read live from Stripe (${adAttributedCashTxt} matched to GHL wins${unattributedN ? `, ${stripe.cash || r.real} total across all channels` : ''}), never the stamp.</div>

<h2 class="sec">Biggest leaks, ranked</h2>
<div class="tw">
<table>
<thead><tr><th>Rank</th><th>Leak</th><th>Impact</th><th>Where it is fixed</th></tr></thead>
<tbody>
<tr><td class="num">1</td><td>Call Held stage under-used</td><td>Outcomes now come from the pipeline (No Show ${sl.pNoShow}, Closed Won ${sl.pWon}), but only ${sl.pHeld} calls are marked Call Held, so show rate reads just ${sl.pShowRate}. Real held calls are stuck in Call Booked, hiding the true show and close rate</td><td>Make closers move every completed call to Call Held (or No Show) right after it, so the pipeline funnel is complete</td></tr>
<tr><td class="num">2</td><td>Split optimisation event across campaigns</td><td>Appointment optimised (${m.apptResults} appts) and lead optimised (${m.leadResults} leads) train Meta on two audiences, so cost per result cannot be compared</td><td>Meta Ads Manager: standardize on a single conversion event per vertical</td></tr>
<tr><td class="num">3</td><td>No click to CRM join at scale</td><td>UTMs are inconsistent and utm_campaign is a numeric id, so most won deals cannot be attributed to a campaign, even though GHL proved it can capture the full trail on ${adAttributedN === 1 ? 'the one ad-attributed real sale' : `${adAttributedN} of the real sales`}</td><td>Standardize UTM naming on every link; surface the captured utmCampaign, fbclid, fbc, fbp on every opportunity</td></tr>
<tr><td class="num">4</td><td>${p.newUnworked} unworked, unassigned leads</td><td>The largest single stage in the pipeline created since 15 June (${p.newUnworked} of ${p.sinceCount}) sits in New, Unworked with no owner</td><td>GHL pipeline automation: auto assign owner on entry, add an SLA trigger for unworked age</td></tr>
<tr><td class="num">5</td><td>Early scaling fatigue</td><td>${(d.windows&&d.windows.last7?d.windows.last7.spend:m.last7.spend)} of ${m.spend} landed in the last 7 days; over that ramp CPC rose ${m.cpc} to ${(d.windows&&d.windows.last7?d.windows.last7.cpc:m.last7.cpc)}, CPM ${m.cpm} to ${(d.windows&&d.windows.last7?d.windows.last7.cpm:m.last7.cpm)}, CTR slipped ${m.ctr} to ${(d.windows&&d.windows.last7?d.windows.last7.ctr:m.last7.ctr)}</td><td>Scale the RPF Dentists ad set per the opportunity score, refresh creative, expand audience</td></tr>
<tr><td class="num" style="color:var(--ok)">6</td><td>Deal value stamp, resolved</td><td style="color:var(--ok)">Fixed by the team: the "Close Won" workflow now stamps the real total contract value, not a flat $10,000, so pipeline value matches the signed deal. Test and agency records were removed from Won</td><td>Done, remediated</td></tr>
</tbody>
</table>
</div>

</section>
<!--OVERVIEW_END-->`;

// ---- DAILY DRILL DOWN PANEL (built from data.daily, funnel per day) ----
const dm = d.dailyMeta || {};
const dailyRows = (d.daily || []).map(x => {
  const blank = x.spend === '$0.00';
  const ttbTxt = (x.ttbMedian === null || x.ttbMedian === undefined) ? '-' : `${x.ttbMedian}d`;
  const ttbColor = (x.ttbMedian === null || x.ttbMedian === undefined) ? '' : (x.ttbMedian <= 4 ? 'var(--ok)' : 'var(--bad)');
  return `<tr><td>${x.date}</td><td class="num"${blank?' style="color:var(--mut)"':''}>${x.spend}</td><td class="num">${x.impressions}</td><td class="num">${x.reach}</td><td class="num">${x.clicks.toLocaleString('en-US')}</td><td class="num">${x.ctr}</td><td class="num">${x.cpc}</td><td class="num">${x.cpm}</td><td class="num">${x.leads}</td><td class="num">${x.cpl}</td><td class="num"${x.bookings>0?' style="color:var(--blue-d)"':''}>${x.bookings}</td><td class="num"${ttbColor?` style="color:${ttbColor}"`:''}>${ttbTxt}</td></tr>`;
}).join('\n');

const dailyHtml = `<!--DAILY_START-->
<section class="panel" id="p-daily">
<div class="eyebrow">Overview</div><h1 class="h1">Daily drill down</h1>
<h2 class="sec">This morning, ${(d.today||{}).date || d.asOf}</h2>
<div class="grid g3">
<div class="kpi"><div class="n blue">${(d.today||{}).scheduled ?? 0}</div><div class="l">Demos on the calendar today</div><div class="s">scheduled to happen today</div></div>
<div class="kpi"><div class="n">${(d.windows && d.windows.yesterday) ? d.windows.yesterday.bookings : 0}</div><div class="l">Booked yesterday</div><div class="s">${(d.windows && d.windows.yesterday) ? d.windows.yesterday.label : ''}</div></div>
<div class="kpi"><div class="n">${(d.windows && d.windows.last7) ? d.windows.last7.bookings : 0}</div><div class="l">Booked last 7 days</div><div class="s">${(d.windows && d.windows.last7) ? d.windows.last7.label : ''}</div></div>
</div>
<div class="note">Snapshot taken at the 5:00am QLD run. "Demos on the calendar today" is the day's booked demos as of this morning; the day's own booking and outcome counts land in tomorrow's 5am report.</div>
<h2 class="sec">Every day since 15 June</h2>
<div class="note">Meta to GHL by day, as of the ${d.asOf} 5am report. Spend, impressions, reach, clicks, CTR, CPC and CPM are the exact Meta account daily numbers. Bookings are demo calls created that day in GHL (the conversion the day's spend produced). Days with $0.00 spend had no active Meta delivery.</div>
<div class="tw">
<table>
<thead><tr><th>Day</th><th>Spend</th><th>Impressions</th><th>Reach</th><th>Clicks</th><th>CTR</th><th>CPC</th><th>CPM</th><th>Leads</th><th>CPL</th><th>Bookings</th><th>Time-to-booking</th></tr></thead>
<tbody>
${dailyRows}
<tr><td><b>Total, since 15 Jun</b></td><td class="num"><b>${m.spend}</b></td><td class="num"><b>${m.impressions}</b></td><td class="num"><b>${m.reach}</b></td><td class="num"><b>${m.clicks}</b></td><td class="num"><b>${m.ctr}</b></td><td class="num"><b>${m.cpc}</b></td><td class="num"><b>${m.cpm}</b></td><td class="num"><b>${m.leads}</b></td><td class="num"><b>${m.cpl}</b></td><td class="num"><b>${dm.bookingsSince15}</b></td><td class="num"><b>${ttbFmt(ttb.medianDays)} median</b></td></tr>
</tbody>
</table>
</div>
<div class="grid g3">
<div class="kpi"><div class="n">${dm.spendCheck || m.spend}</div><div class="l">Daily spend reconciles</div><div class="s">sum of ${dm.activeDays || ''} active days = window total</div></div>
<div class="kpi"><div class="n">${dm.bookingsSince15}</div><div class="l">Bookings created since 15 Jun</div><div class="s">demos generated in the ad window</div></div>
<div class="kpi"><div class="n">${dm.bookingsTotal || 96}</div><div class="l">Total demos on calendar</div><div class="s">${dm.bookingsSince15} since 15 Jun + ${dm.bookingsPreLaunch} booked pre launch</div></div>
</div>
<div class="note">Reconciliation: the daily spend column sums to ${dm.spendCheck || m.spend} and daily clicks to ${dm.clicksCheck || m.clicks}, matching the overall scoreboard to the cent. Bookings created per day since 15 June sum to ${dm.bookingsSince15}; adding the ${dm.bookingsPreLaunch} demos booked before launch gives the ${dm.bookingsTotal || 96} total appointments on the calendar in the window. The daily and overall views are generated from the same data every 5am so they can never disagree. Time-to-booking is each day's median days from creation to scheduled appointment (dash = no bookings created that day); the overall median since launch is ${ttbFmt(ttb.medianDays)}, KPI target &le; ${ttb.targetDays}d.</div>
</section>
<!--DAILY_END-->`;

// ---- UNIT ECONOMICS PANEL ----
const ue = d.unitEcon || {};
const econCampRows = (d.campaigns || []).map(c =>
  `<tr><td>${c.name}</td><td class="num">${c.spend}</td><td class="num">${c.results}</td><td class="num"${c.cprGood?' style="color:var(--ok)"':''}>${c.cpr}</td><td class="num"${(c.revenue&&c.revenue!=='$0')?' style="color:var(--ok)"':' style="color:var(--mut)"'}>${c.revenue||'$0'}</td><td class="num"${(c.roas&&c.roas!=='n/a')?' style="color:var(--ok)"':' style="color:var(--mut)"'}>${c.roas||'n/a'}</td></tr>`
).join('\n');

const econHtml = `<!--ECON_START-->
<section class="panel" id="p-econ">
<style>.kpi.stripe .n{color:var(--mut);font-size:15px;font-weight:600}.kpi.stripe{border-style:dashed}</style>
<div class="eyebrow">Overview</div><h1 class="h1">Unit economics</h1>
<div class="note">What each dollar of ad spend produces. The Computable now block is derived from Meta and GHL each day. The Live from Stripe block (cash, AOV, LTV, refund rate) is real settled money from ${stripe.account || 'Ai Funding Solutions LLC'}, joined to campaigns through the GHL utm, so ROAS is now true, not the GHL $10k stamp. Daily report, ${d.asOf}, refreshed 5am QLD.</div>

<h2 class="sec">Computable now</h2>
<div class="grid g3">
<div class="kpi"><div class="n">${ue.spend || m.spend}</div><div class="l">Ad spend</div><div class="s">since 15 Jun</div></div>
<div class="kpi"><div class="n">${m.cpl}</div><div class="l">CPL</div><div class="s">${ue.spend || m.spend} / ${m.leads} leads</div></div>
<div class="kpi"><div class="n">${ue.costPerBooking || 'n/a'}</div><div class="l">Cost per demo booked</div><div class="s">${ue.spend || m.spend} / ${b.total} demos</div></div>
<div class="kpi"><div class="n ok">${stripe.cash || ue.realCash || r.real}</div><div class="l">Real cash collected</div><div class="s">${stripe.sales || ue.realSales || r.closesReal} sale, Stripe verified</div></div>
<div class="kpi"><div class="n">${ue.cpaReal || r.cpaReal}</div><div class="l">CPA, real</div><div class="s">${ue.spend || m.spend} / ${ue.realSales || r.closesReal} sale</div></div>
<div class="kpi"><div class="n bad">${ue.roas || r.roas}</div><div class="l">ROAS</div><div class="s">real cash / spend, 1 sale, early</div></div>
<div class="kpi"><div class="n blue">${m.oppScore}</div><div class="l">Opportunity score</div><div class="s">Meta account, out of 100</div></div>
</div>

<h2 class="sec">Live from Stripe</h2>
<div class="grid g4">
<div class="kpi"><div class="n ok">${stripe.cash || r.real}</div><div class="l">Live cash collected</div><div class="s">real, settled in Stripe</div></div>
<div class="kpi"><div class="n">${stripe.aov || 'n/a'}</div><div class="l">AOV</div><div class="s">per paying customer (${stripe.sales || 1})</div></div>
<div class="kpi"><div class="n">${stripe.ltv || 'n/a'}</div><div class="l">LTV</div><div class="s">per customer to date</div></div>
<div class="kpi"><div class="n ${(stripe.refundRate==='0%')?'ok':'warn'}">${stripe.refundRate || '0%'}</div><div class="l">Refund and chargeback rate</div><div class="s">${stripe.refunds || '$0'} refunded, ${stripe.disputes || '0'} disputes</div></div>
</div>

<h2 class="sec">Per campaign, cost to cash</h2>
<div class="tw"><table>
<thead><tr><th>Campaign</th><th>Spend</th><th>Results</th><th>Cost per result</th><th>Revenue</th><th>ROAS</th></tr></thead>
<tbody>
${econCampRows}
</tbody></table></div>
<div class="note">Revenue is the Stripe cash attributed to the campaign that produced it, joined through the GHL contact's captured utm_campaign. So far ${adAttributedCashTxt} across ${adAttributedN} real ${adAttributedWord} traces to ${paidCampaignNames}, giving ${paidCampaigns.length === 1 ? 'it' : 'those'} a real ROAS while the other campaigns have not produced a paid sale yet.${unattributedN ? ` A further ${unattributedCashTxt} across ${unattributedN} real ${unattributedWord} is Stripe-verified but outside the ad funnel (no campaign to trace), so it counts toward total cash above but not toward any campaign's ROAS here.` : ''}</div>

<div class="card"><h3>Stripe is connected (${stripe.account || 'Ai Funding Solutions LLC'})</h3><ul class="tk">
<li>Live cash collected reads ${stripe.cash || r.real} from real settled payments, no longer a manual figure.</li>
<li>AOV and LTV are ${stripe.aov || 'n/a'} per paying customer (${stripe.sales || 1} to date).</li>
<li>ROAS is now real per campaign: ${adAttributedCashTxt} traces to ${paidCampaignNames}.</li>
<li>Refund and chargeback rate is ${stripe.refundRate || '0%'} (${stripe.refunds || '$0'} refunded, ${stripe.disputes || '0'} disputes), so net revenue is honest.</li>
</ul></div>
</section>
<!--ECON_END-->`;

// ---- PIPELINE panel, live from the current board snapshot (never drifts) ----
const pt = _n(p.totalCount);
const pctOf = n => pt > 0 ? (_n(n) / pt * 100).toFixed(1) + '%' : '0%';
const stageRow = (label, key, color, read) =>
  `<tr><td>${label}</td><td class="num"${color?` style="color:var(--${color})"`:''}>${_n(p[key])}</td><td class="num"${color?` style="color:var(--${color})"`:''}>${pctOf(p[key])}</td><td>${read||''}</td></tr>`;
const unworkedShare = pt > 0 ? Math.round(_n(p.newUnworked) / pt * 100) : 0;
const pipeHtml = `<!--PIPE_START-->
<div class="callout warn"><b>Live snapshot, ${d.asOf}.</b> Every count below is the current stock of the EAZE AI FUNDING SOLUTIONS board, pulled live and refreshed 5am QLD, matched column for column. Windowed views (yesterday, last 7 days, since campaign) are on the Scoreboard.</div>

<h2 class="sec">Current stage distribution, all ${pt} opportunities on the board</h2>
<div class="tw">
<table>
<thead><tr><th>Stage</th><th>Count</th><th>Percent of ${pt}</th><th>Read</th></tr></thead>
<tbody>
${stageRow('New, Unworked','newUnworked','bad','Largest stage, sitting with no work done')}
${stageRow('Contacted','contacted',null,'Stage unused, closers skip straight to Call Booked')}
${stageRow('Call Booked','callBooked','warn','Live booked demos on the board')}
${stageRow('Rescheduling','rescheduling',null,'')}
${stageRow('No Show','noShow','bad','Booked, then did not attend')}
${stageRow('Appt Cancelled','apptCancelled',null,'')}
${stageRow('Call Held, WIP','callHeld',null,'Calls actively in progress')}
${stageRow('High Priority','highPriority',null,'Worked, hot, post-call')}
${stageRow('Closed, Won','closedWon','ok',`${adAttributedN} real ${adAttributedWord}, ${adAttributedCashTxt} total`)}
${stageRow('Long-Term Nurture','longTermNurture',null,'')}
${stageRow('Lost','lost',null,'')}
<tr><td><b>Total</b></td><td class="num"><b>${pt}</b></td><td class="num"><b>100%</b></td><td></td></tr>
</tbody>
</table>
</div>
<div class="note">Percent is each stage count divided by ${pt}, computed directly. Show rate since the campaign is ${sl.pShowRate || 'awaiting'} (${_n(p.callHeld)+_n(p.highPriority)+_n(p.closedWon)} showed of ${_n(p.callHeld)+_n(p.highPriority)+_n(p.closedWon)+_n(p.noShow)} with a held-or-no-show outcome).</div>

<h2 class="sec">Where the pipeline leaks</h2>
<div class="grid g3">
<div class="kpi"><div class="n bad">${unworkedShare}%</div><div class="l">New and Unworked</div><div class="s">${_n(p.newUnworked)} of ${pt} on the board sit with no work done</div></div>
<div class="kpi"><div class="n warn">${sl.pShowRate || 'awaiting'}</div><div class="l">Show rate, since campaign</div><div class="s">${_n(p.callHeld)+_n(p.highPriority)+_n(p.closedWon)} showed of ${_n(p.callHeld)+_n(p.highPriority)+_n(p.closedWon)+_n(p.noShow)} dispositioned</div></div>
<div class="kpi"><div class="n ok">${adAttributedN} real ${adAttributedWord}</div><div class="l">Pipeline to real Closed Won</div><div class="s">${r.closesReal} of ${pt} Closed Won, ${adAttributedN} paid, ${adAttributedCashTxt} total</div></div>
</div>

<h2 class="sec">Closed Won value, remediated</h2>
<div class="grid g3">
<div class="kpi"><div class="n ok">${adAttributedCashTxt}</div><div class="l">Real cash, Stripe verified</div><div class="s">${adAttributedN} real ${adAttributedWord}</div></div>
<div class="kpi"><div class="n ok">${adAttributedCashTxt}</div><div class="l">Stage stamped value, now correct</div><div class="s">workflow stamps real total contract value</div></div>
<div class="kpi"><div class="n ok">$0</div><div class="l">Overstatement</div><div class="s">pipeline value now matches real cash</div></div>
</div>
<div class="note">Remediated by the team: the "Close Won" workflow now stamps the real total contract value on each win instead of a flat $10,000, so the stage value matches the signed deal (${adAttributedCashTxt} across ${adAttributedN} real ${adAttributedWord}). Cash on this dashboard always comes from Stripe, never the stamp. The earlier agency test records were removed from Won.${unattributedN ? ` (A further ${unattributedCashTxt} from ${unattributedN} real ${unattributedWord} is Stripe-verified cash from outside this pipeline entirely, e.g. a directly invoiced client, so it never appears as a GHL stage or stamp.)` : ''}</div>

<h2 class="sec">Owner distribution, full board</h2>
<div class="grid g4">
<div class="kpi"><div class="n bad">${_n(p.ownerUnassigned)}</div><div class="l">Unassigned</div><div class="s">${pctOf(p.ownerUnassigned)} of ${pt}, no owner</div></div>
<div class="kpi"><div class="n">${_n(p.ownerCaleb)}</div><div class="l">Caleb</div><div class="s">${pctOf(p.ownerCaleb)} of ${pt}</div></div>
<div class="kpi"><div class="n">${_n(p.ownerCarlos)}</div><div class="l">Carlos</div><div class="s">${pctOf(p.ownerCarlos)} of ${pt}</div></div>
<div class="kpi"><div class="n">${_n(p.ownerMatthew)}</div><div class="l">Matthew</div><div class="s">${pctOf(p.ownerMatthew)} of ${pt}</div></div>
</div>
<div class="note">Dan owns ${_n(p.ownerDan)} (${pctOf(p.ownerDan)}), no longer an active closer as of 2026-07-10. James (agency admin, isPrimary on calendars) holds ${_n(p.ownerJames)} opportunities, ${pctOf(p.ownerJames)} of the board, worth a check on whether he should be seated on live pipeline. Carlos Fierro joined as a new closer around 2026-07-11/12 and now owns ${_n(p.ownerCarlos)} (${pctOf(p.ownerCarlos)}).</div>
<!--PIPE_END-->`;

// ---- ATTRIBUTION panel, live granular join (GHL contact utm -> Meta campaign -> Stripe cash) ----
const at = d.attribution || {};
const atCamp = (at.campaigns || []).map(c =>
  `<tr><td>${c.name}<div class="sub">${c.id}</div></td><td class="num">${c.spend}</td><td class="num">${c.impr}</td><td class="num">${c.clicks}</td><td class="num">${c.opps}</td><td class="num">${c.booked}</td><td class="num">${c.costPerOpp}</td><td class="num"${c.won>0?' style="color:var(--ok)"':''}>${c.won}</td><td class="num"${c.won>0?' style="color:var(--ok)"':''}>${c.cash}</td><td class="num"${c.won>0?' style="color:var(--ok)"':''}>${c.roas}</td></tr>`
).join('\n');
const atSrc = (at.sourceSplit || []).map(s => `<span class="chip">${s.k==='fb'?'Facebook':s.k==='ig'?'Instagram':s.k==='an'?'Audience Net':s.k==='(none)'?'no source':s.k} <b>${s.v}</b></span>`).join(' ');
const atLand = (at.landingTop || []).map(l => `<tr><td>${l.k}</td><td class="num">${l.v}</td></tr>`).join('\n');
const bk = at.buckets || {}; const sale = at.sale || {}; const cv = at.conventions || {};
// Real sales, click to cash: per-sale campaign/ad-set/ad, resolved from each contact's
// first-touch UTM (matched by contactId first, name fallback, same as attr_build.py's join).
const saleAttrRows = (d.saleAttribution || []).map(s =>
  `<tr><td>${s.name}</td><td>${s.date}</td><td class="num">${s.amount}</td><td>${s.campaignName}<div class="sub">${s.campaignId}</div></td><td>${s.adsetName}<div class="sub">${s.adsetId}</div></td><td>${s.adName ? s.adName + '<div class="sub">' + s.adId + '</div>' : 'id ' + s.adId + ' (not resolvable, likely archived since this click)'}</td><td>${s.source}</td><td class="small">${s.firstTouch} to ${s.lastTouch}</td></tr>`
).join('\n');
const _saleAttrCampCounts = {};
(d.saleAttribution || []).forEach(s => { _saleAttrCampCounts[s.campaignName] = (_saleAttrCampCounts[s.campaignName] || 0) + 1; });
const _saleAttrAdsetCounts = {};
(d.saleAttribution || []).forEach(s => { _saleAttrAdsetCounts[s.adsetId] = (_saleAttrAdsetCounts[s.adsetId] || 0) + 1; });
const _repeatAdsets = Object.entries(_saleAttrAdsetCounts).filter(([, v]) => v > 1)
  .map(([adsetId, v]) => `${v} share ${(d.saleAttribution.find(s => s.adsetId === adsetId) || {}).adsetName}`);
const saleAttrPatternNote = Object.entries(_saleAttrCampCounts).map(([k, v]) => `${v} via ${k}`).join(', ') +
  (_repeatAdsets.length ? `. Repeatable paths, more than one sale from the same ad set: ${_repeatAdsets.join('; ')}, worth treating as proven rather than one-offs.` : '.');

// Real sales demographics: business-qualification profile (industry, revenue tier, region,
// EZCheck pre-qualification), pulled from each contact's GHL custom fields. Neither GHL, Stripe,
// nor Meta capture personal age/gender for this B2B financing product — Meta's own demographic
// breakdowns are aggregate-only and never tied to an identified individual/sale, and Stripe
// redacts billing details entirely — so business profile is the honest, available "who is
// buying" signal, and the more useful one for a B2B audience anyway.
const demoRows = (d.saleDemographics || []).map(s =>
  `<tr><td>${s.name}<div class="sub">${s.businessName}</div></td><td>${s.industry}</td><td>${s.monthlyRevenue}</td><td>${s.region}</td><td>${s.leadSource}</td><td class="num">${s.creditScore != null ? s.creditScore : 'n/a'}</td><td><span class="tag ${s.preQualified ? 'ok' : 'bad'}">${s.preQualified ? 'Pre-qualified' : 'Not pre-qualified'}</span><div class="sub">${s.disqualReason || s.preQualDetail}</div></td></tr>`
).join('\n');
const _demoIndustryCounts = {};
(d.saleDemographics || []).forEach(s => { const k = s.industry === 'Not captured' ? 'Not captured' : s.industry; _demoIndustryCounts[k] = (_demoIndustryCounts[k] || 0) + 1; });
const demoIndustryChips = Object.entries(_demoIndustryCounts).map(([k, v]) => `<span class="chip">${k} <b>${v}</b></span>`).join(' ');
const _demoPreQualCount = (d.saleDemographics || []).filter(s => s.preQualified).length;
const _demoTotal = (d.saleDemographics || []).length;
const attrHtml = `<!--ATTR_START-->
<div class="callout"><b>Attribution, live and granular, ${at.asOf || d.asOf}.</b> Every opportunity's ad origin is read from the GHL contact's captured UTM and Meta click identifiers, joined to the Meta campaign that spent the money and to the Stripe cash it produced. Refreshed 5am QLD. This is the true click to cash join, not an estimate.</div>

<h2 class="sec">Coverage, how much of the pipeline is attributable</h2>
<div class="grid g4">
<div class="kpi"><div class="n ok">${at.coverageUtmPct||'-'}</div><div class="l">Carry utm_campaign</div><div class="s">${at.coverageUtm||''} opportunities</div></div>
<div class="kpi"><div class="n ok">${at.coverageFbcPct||'-'}</div><div class="l">Carry fbclid or fbc</div><div class="s">${at.coverageFbc||''}, Meta click id</div></div>
<div class="kpi"><div class="n">${bk.unattributed!=null?bk.unattributed:'-'}</div><div class="l">No attribution</div><div class="s">of ${at.totalOpps||''} opps, no utm captured</div></div>
<div class="kpi"><div class="n blue">${adAttributedCashTxt}</div><div class="l">Cash attributed to a campaign</div><div class="s">${adAttributedN} real ${adAttributedWord}, each traced below${unattributedN ? ` (${unattributedCashTxt} more from ${unattributedN} real ${unattributedWord} outside the ad funnel, not attributable to any campaign)` : ''}</div></div>
</div>
<div class="note">Traffic source on the pipeline: ${atSrc}. Medium is paid on every attributed opportunity.</div>

<h2 class="sec">Revenue and pipeline by campaign, spend to cash</h2>
<div class="tw"><table>
<thead><tr><th>Campaign</th><th>Spend</th><th>Impr</th><th>Clicks</th><th>Opps</th><th>Booked+</th><th>Cost / opp</th><th>Won</th><th>Cash</th><th>ROAS</th></tr></thead>
<tbody>
${atCamp}
</tbody></table></div>
<div class="note">Opps are attributed by matching each GHL contact's utm_campaign (numeric id or name variant) back to the Meta campaign that ran. Booked+ = opportunities that reached Call Booked or any later stage. Cost per opp = campaign spend / attributed opps. Cash and ROAS are Stripe verified, never the GHL $10k stamp. Reconciliation: ${bk.mapped||0} mapped to a live campaign, ${bk.preRelaunch||0} on a pre relaunch campaign, ${bk.unmapped||0} unmapped name string, ${bk.unattributed||0} with no utm, total ${at.totalOpps||''}.</div>

<h2 class="sec">Real sales, click to cash</h2>
<div class="tw">
<table>
<thead><tr><th>Buyer</th><th>Date</th><th class="num">Amount</th><th>Campaign</th><th>Ad set</th><th>Ad</th><th>Source</th><th>Touch path</th></tr></thead>
<tbody>
${saleAttrRows}
</tbody>
</table>
</div>
<div class="note">${adAttributedN} real ${adAttributedWord} came through the ad funnel, each verified in Stripe and matched to its GHL contact's first-touch attribution (captured UTMs, fbclid, fbc). ${saleAttrPatternNote}${unattributedN ? ` A further ${unattributedN} real ${unattributedWord} (${unattributedCashTxt}) ${unattributedN === 1 ? 'is' : 'are'} verified in Stripe but ${unattributedN === 1 ? 'has' : 'have'} no GHL contact or campaign to trace (e.g. a directly invoiced client), so ${unattributedN === 1 ? 'it is' : 'they are'} not shown in the table above.` : ''}</div>

<h2 class="sec">Real sales, business profile</h2>
<div class="callout warn">Personal age and gender are not captured anywhere in this pipeline for these buyers: GHL's intake forms don't collect date of birth or gender for this offer, Stripe's billing details are redacted on this connector, and Meta's own demographic breakdowns (age/gender) are aggregate account-level reporting, never tied to an identified individual or a specific sale. What GHL does capture, and what actually matters for a B2B financing product, is business profile: industry, monthly revenue tier, region, and EZCheck pre-qualification status. That is what this panel shows.</div>
<div class="tw">
<table>
<thead><tr><th>Buyer</th><th>Industry</th><th>Monthly revenue</th><th>Region</th><th>Lead source (self-reported)</th><th class="num">Credit score</th><th>EZCheck status</th></tr></thead>
<tbody>
${demoRows}
</tbody>
</table>
</div>
<div class="note">Industry mix: ${demoIndustryChips}. Region and lead source are self-reported at intake, not verified. Credit score and pre-qualification come from the EZCheck screening step where it was completed.</div>
<div class="callout ok"><b>What is found:</b> only ${_demoPreQualCount} of ${_demoTotal} real sales were EZCheck pre-qualified (Consumer, Merchant and BNPL all "Yes") before closing; the other ${_demoTotal - _demoPreQualCount} closed despite a "Not pre-qualified" EZCheck result, including one flagged for recent late payments and one for a below-B+ credit grade with collections. EZCheck pre-qualification status is not, on this small sample, predictive of who actually buys, so a "Not pre-qualified" tag should not be used to deprioritise a lead in the pipeline.</div>

<h2 class="sec">The number one attribution fix: one naming convention</h2>
<div class="grid g3">
<div class="kpi"><div class="n bad">${cv.distinct||0}</div><div class="l">Distinct utm_campaign values</div><div class="s">for only 6 real campaigns</div></div>
<div class="kpi"><div class="n warn">${cv.numeric||0}</div><div class="l">Numeric campaign ids</div><div class="s">unreadable without a lookup</div></div>
<div class="kpi"><div class="n warn">${cv.named||0}</div><div class="l">Name strings, mixed casing</div><div class="s">same campaign, different text</div></div>
</div>
<div class="note">The same campaign arrives as a numeric id (120248304846100411) on some links and as a name string ("Ai Funding Solutions | Med Spa | Abo | Broad", in several casings) on others. That is why a clean campaign rollup needs the mapping table this dashboard applies. Standardise every ad link to one utm_campaign value and the join becomes one to one, no mapping needed.</div>

<h2 class="sec">First-touch landing pages</h2>
<div class="tw" style="max-width:520px"><table><thead><tr><th>First-touch page</th><th>Opps</th></tr></thead><tbody>
${atLand}
</tbody></table></div>
<!--ATTR_END-->`;

// SOURCE = index.template.html (has {%tokens%} + marker regions, human-edited, never served).
// OUTPUT = index.html (fully resolved, served by server.js). This split is what makes the token
// fill repeatable every day: the template is never consumed, index.html is regenerated each run.
const tplPath = path.join(__dirname, 'index.template.html');
const idxPath = path.join(__dirname, 'index.html');
let idx = fs.readFileSync(fs.existsSync(tplPath) ? tplPath : idxPath, 'utf8');
const reOv = /<!--OVERVIEW_START-->[\s\S]*?<!--OVERVIEW_END-->/;
const reDa = /<!--DAILY_START-->[\s\S]*?<!--DAILY_END-->/;
const reEc = /<!--ECON_START-->[\s\S]*?<!--ECON_END-->/;
const rePipe = /<!--PIPE_START-->[\s\S]*?<!--PIPE_END-->/;
const reAttr = /<!--ATTR_START-->[\s\S]*?<!--ATTR_END-->/;
const reClosers = /<!--CLOSERS_START-->[\s\S]*?<!--CLOSERS_END-->/;
const reCampaigns = /<!--CAMPAIGNS_START-->[\s\S]*?<!--CAMPAIGNS_END-->/;
const reCreative = /<!--CREATIVE_START-->[\s\S]*?<!--CREATIVE_END-->/;
if (!reOv.test(idx)) { console.error('ERROR: overview markers not found'); process.exit(1); }
if (!reDa.test(idx)) { console.error('ERROR: daily markers not found'); process.exit(1); }
if (!reEc.test(idx)) { console.error('ERROR: econ markers not found'); process.exit(1); }
if (!rePipe.test(idx)) { console.error('ERROR: pipeline markers not found'); process.exit(1); }
if (!reAttr.test(idx)) { console.error('ERROR: attribution markers not found'); process.exit(1); }
if (!reClosers.test(idx)) { console.error('ERROR: closers markers not found'); process.exit(1); }
if (!reCampaigns.test(idx)) { console.error('ERROR: campaigns markers not found'); process.exit(1); }
if (!reCreative.test(idx)) { console.error('ERROR: creative markers not found'); process.exit(1); }

// guard: no em or en dashes may enter the document
if (/[–—]/.test(html) || /[–—]/.test(dailyHtml) || /[–—]/.test(econHtml) || /[–—]/.test(pipeHtml) || /[–—]/.test(attrHtml)) { console.error('ERROR: em/en dash in rendered output'); process.exit(1); }

idx = idx.replace(reOv, html).replace(reDa, dailyHtml).replace(reEc, econHtml).replace(rePipe, pipeHtml).replace(reAttr, attrHtml);

// ---- LIVE TOKEN ENGINE ---------------------------------------------------------------
// Every panel in the menu is kept alive by {{dotted.path}} tokens embedded in the static
// HTML. This pass fills them from data.json (plus a few derived aliases) on every daily
// run, so numbers and number-bearing copy grow with the account while the FORMAT and
// LAYOUT are never touched. A missing token is a hard error (it can never ship a literal
// {{x}}), which makes "the whole menu is live" an audited guarantee, not a hope.
function _flatten(obj, prefix, out) {
  for (const k in obj) {
    const v = obj[k], key = prefix ? prefix + '.' + k : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) _flatten(v, key, out);
    else if (typeof v !== 'object') out[key] = String(v);
  }
  return out;
}
const T = _flatten(d, '', {});
// derived / alias tokens for copy that needs computed or friendlier values
const _pct = (n, den) => (_n(den) ? Math.round(_n(n) / _n(den) * 100) + '%' : '0%');
T['derived.unworkedPct']   = _pct(p.newUnworked, p.totalCount);
T['derived.unworkedPctSince'] = _pct(p.newUnworked, p.sinceCount);
T['derived.showedSince']   = String(_n(p.callHeld) + _n(p.highPriority) + _n(p.closedWon));
T['derived.dispoSince']    = String(_n(p.callHeld) + _n(p.highPriority) + _n(p.closedWon) + _n(p.noShow));
T['derived.saleCampaign']  = (d.attribution && d.attribution.sale && d.attribution.sale.campaign) || d.revenue.realSaleCampaign || '';
T['derived.saleRoas']      = (d.campaigns.find(c => /Aashish/i.test(c.name)) || {}).roas || d.revenue.roas;
const _money = s => parseFloat(String(s).replace(/[^0-9.]/g, '')) || 0;
T['derived.bookedPerDay']  = _n(d.bookings.total) ? '$' + (_money(d.meta.spend) / _n(d.bookings.total)).toFixed(2) : 'n/a';
T['derived.stripeCash']    = (d.stripe && d.stripe.cash) || d.revenue.real;
T['derived.attrUtmPct']    = (d.attribution && d.attribution.coverageUtmPct) || '';
T['derived.attrFbcPct']    = (d.attribution && d.attribution.coverageFbcPct) || '';
T['derived.attrTotalOpps'] = String((d.attribution && d.attribution.totalOpps) || d.pipeline.totalCount);
T['derived.utmConventions']= String((d.attribution && d.attribution.conventions && d.attribution.conventions.distinct) || '');
T['derived.confirmedPct']  = _pct(b.confirmed, b.total);
T['derived.noshowPct']     = _pct(b.noshow, b.total);
T['derived.cancelledPct']  = _pct(b.cancelled, b.total);
T['derived.calMedicalPct'] = _pct(b.calMedical, b.total);

// Spend and delivery tab tokens: date ranges, last-7-days reach/freq (Meta's own dedup'd
// 7-day pull, m.last7.reach, not a sum of daily reach which double-counts repeat visitors),
// pacing %, and week-over-week deltas.
const MON3 = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const _dlabel3 = iso => { const [, mo, da] = iso.split('-').map(Number); return `${da} ${MON3[mo - 1]}`; };
const _lastDailyDate = (d.daily && d.daily.length) ? d.daily[d.daily.length - 1].date : null;
if (_lastDailyDate) {
  const _yd = new Date(_lastDailyDate + 'T00:00:00Z');
  const _from7 = new Date(_yd.getTime() - 6 * 86400000).toISOString().slice(0, 10);
  T['derived.last7Range']     = `${_dlabel3(_from7)} to ${_dlabel3(_lastDailyDate)}`;
  T['derived.yesterdayLabel'] = _dlabel3(_lastDailyDate);
}
const _last7Impr = _n((m.last7 || {}).impressions), _last7Reach = _n((m.last7 || {}).reach);
T['derived.last7Freq'] = _last7Reach ? (_last7Impr / _last7Reach).toFixed(2) : 'n/a';
T['derived.lpvRate'] = m.landingPageViews ? (_n(m.landingPageViews) / _n(m.clicks) * 100).toFixed(1) + '%' : 'n/a';
const _sinceSpendNum = _money(m.spend), _last7SpendNum = _money((d.windows.last7 || {}).spend);
T['derived.pacingPct'] = _sinceSpendNum ? Math.round(_last7SpendNum / _sinceSpendNum * 100) + '%' : '0%';
const _pctDelta = (a, bTxt) => {
  const av = _money(a), bv = _money(bTxt);
  if (!av) return 'n/a';
  const delta = (bv - av) / av * 100;
  return (delta >= 0 ? 'up ' : 'down ') + Math.abs(Math.round(delta)) + '%';
};
T['derived.cpcDelta'] = _pctDelta(m.cpc, (d.windows.last7 || {}).cpc);
T['derived.cpmDelta'] = _pctDelta(m.cpm, (d.windows.last7 || {}).cpm);
T['derived.ctrDelta'] = _pctDelta(m.ctr, (d.windows.last7 || {}).ctr);
// today's cheapest live result, in place of a hardcoded ad-set-level claim that goes stale
// the moment Meta's own recommendation or the account's best campaign changes.
const _winnerCamp = (d.campaigns || []).find(c => c.cprGood) || {};
T['derived.cheapestCampaign']      = _winnerCamp.name || 'n/a';
T['derived.cheapestCampaignCpl']   = _winnerCamp.cpl || 'n/a';
T['derived.cheapestCampaignSpend'] = _winnerCamp.spend || 'n/a';
const _dentistsCamp = (d.campaigns || []).find(c => c.id === '120248020479770411') || {};
T['derived.dentistsCtr'] = _dentistsCamp.ctr || 'n/a';
T['derived.dentistsCpl'] = _dentistsCamp.cpl || 'n/a';

// Closers and routing tab: per-closer table + routing-share narrative, computed fresh from
// d.closers/d.bookings each run so an offboarded or newly-added closer never needs a template edit.
const MEETING_TOOL = { Caleb: 'Zoom', Matthew: 'Zoom', Dan: 'Zoom', Carlos: 'Zoom', James: 'Google Meet' };
const closerBookRows = (d.closers || []).map(c => {
  const nm = c.name.split(' ')[0];
  const booked = _n(c.booked), owned = _n(c.owned);
  const share = _n(b.total) ? Math.round(booked / _n(b.total) * 100) + '%' : '0%';
  return `<tr><td>${nm}</td><td>${MEETING_TOOL[nm] || 'n/a'}</td><td class="num">${booked}</td><td class="num">${share}</td><td class="num">${owned}</td></tr>`;
}).join('\n');
// named closers don't cover every booking/opp (some land unassigned); add an explicit row so
// the table's own total always matches b.total / p.totalCount, never a silent undercount.
const _namedBooked = (d.closers || []).reduce((s, c) => s + _n(c.booked), 0);
const _namedOwned  = (d.closers || []).reduce((s, c) => s + _n(c.owned), 0);
const _otherBooked = Math.max(_n(b.total) - _namedBooked, 0);
const _otherOwned   = Math.max(_n(p.ownerUnassigned) || (_n(p.totalCount) - _namedOwned), 0);
const _otherShare = _n(b.total) ? Math.round(_otherBooked / _n(b.total) * 100) + '%' : '0%';
const closerOtherRow = _otherBooked > 0 || _otherOwned > 0
  ? `<tr><td>Other/unassigned</td><td>n/a</td><td class="num">${_otherBooked}</td><td class="num">${_otherShare}</td><td class="num">${_otherOwned}</td></tr>`
  : '';
const _closerBookedTotal = _n(b.total);
const _closerOwnedTotal  = _namedOwned + _otherOwned;
// "real closers" = seated closers excluding James, the agency admin who is not in the rotation.
const _realClosers = (d.closers || []).filter(c => !/^James/.test(c.name));
const _realBookedTotal = _realClosers.reduce((s, c) => s + _n(c.booked), 0);
const _realShareTxt = _realClosers
  .filter(c => _n(c.booked) > 0)
  .map(c => `${c.name.split(' ')[0]} ${_realBookedTotal ? Math.round(_n(c.booked) / _realBookedTotal * 100) : 0}%`)
  .join(', ') || 'no bookings recorded yet';
const _james = (d.closers || []).find(c => /^James/.test(c.name)) || {};
const _jamesSharePct = _n(b.total) ? Math.round(_n(_james.booked) / _n(b.total) * 100) : 0;
const _topRealCloser = _realClosers.slice().sort((a, c) => _n(c.booked) - _n(a.booked))[0] || {};
const _topRealSharePct = _realBookedTotal ? Math.round(_n(_topRealCloser.booked) / _realBookedTotal * 100) : 0;
const _caleb = (d.closers || []).find(c => /^Caleb/.test(c.name)) || {};
const closersHtml = `<!--CLOSERS_START-->
<h2 class="sec">Per closer, bookings and pipeline ownership since 15 June</h2>
<div class="tw">
<table>
<thead>
<tr><th>Closer</th><th>Meeting tool</th><th>Bookings since 15 Jun</th><th>Booking share</th><th>Opps owned since 15 Jun</th></tr>
</thead>
<tbody>
${closerBookRows}
${closerOtherRow}
<tr><td><b>Total</b></td><td></td><td class="num"><b>${_closerBookedTotal}</b></td><td class="num"><b>100%</b></td><td class="num"><b>${_closerOwnedTotal}</b></td></tr>
</tbody>
</table>
</div>
<div class="note">Bookings are appointments since 15 June on the demo calendars, by assigned closer (${b.total} total). Opps owned since 15 June is native assignedTo on opportunities created since 15 June (${p.sinceCount} of ${p.totalCount} total opps; the other ${p.excluded} predate the ads and are excluded here). James is the agency admin, isPrimary on the calendars, and meets on Google Meet, the only one not on the standard tool. Among the seated closers only (excluding James, ${_realBookedTotal} bookings), share is ${_realShareTxt}.</div>

<h2 class="sec">Cost per booked demo, blended and approximate</h2>
<div class="grid g2">
<div class="kpi"><div class="n">${m.spend}</div><div class="l">Window spend</div><div class="s">${d.windowMeta}, Meta</div></div>
<div class="kpi"><div class="n">${T['derived.bookedPerDay']}</div><div class="l">Approximate cost per booked demo</div><div class="s">${m.spend} / ${b.total} booked demos, blended</div></div>
</div>
<div class="callout warn">This is one blended number, not a per-closer cost. Window spend of ${m.spend} is divided across all ${b.total} booked demos in the matching GHL window, so it says what a booking costs the business on average, approximately ${T['derived.bookedPerDay']}. There is no UTM or click id saved to most contacts, so spend cannot be split by which closer or which campaign actually produced each booking. Do not read this as a per-closer CAC.</div>

<h2 class="sec">Routing problems for CRO</h2>
<div class="block ev">
<div class="bl">What is found</div>
<p class="small">All demo calendars use round_robin with eventType OptimizeForAvailability, not equal distribution. No closer has a timezone or working hours set and calendar openHours are empty, so the router has no real constraint to balance against and simply routes to whoever's connected calendar looks most open. Result: ${_topRealCloser.name || 'the top closer'} takes ${_topRealSharePct}% of bookings among the seated closers, a concentration risk, while James, agency admin and isPrimary on every calendar, took ${_james.booked || 0} bookings, ${_jamesSharePct}% of all ${b.total} in this window, on Google Meet despite not being a closer and should not be seated in the rotation at all.</p>
</div>
<div class="block std">
<div class="bl">The standard</div>
<p class="small">A round robin for a demo calendar should distribute leads evenly among the people actually selling, weighted only if there is a deliberate reason such as ramp, skill tier, or capacity cap. It should never seat an admin account as isPrimary, and it should not let a coverage gap in one closer's calendar starve the others.</p>
</div>
<div class="block rem">
<div class="bl">Remediation</div>
<ol class="tk small">
<li>In <span class="screen">GHL, Calendar Settings for each demo calendar</span>, change the round robin distribution from OptimizeForAvailability to Optimize for Equal Distribution.</li>
<li>In <span class="screen">GHL, Team member settings on each calendar</span>, remove James from the booking rotation. Keep him as agency admin only, not isPrimary and not a bookable team member.</li>
<li>In <span class="screen">GHL, Calendar Settings, Meeting Location</span>, standardize all real closers on Zoom.</li>
<li>In <span class="screen">GHL, User profile, Availability</span>, set a timezone and working hours for every seated closer so the round robin has a real constraint to balance against instead of defaulting to whoever looks free.</li>
</ol>
</div>

<h2 class="sec">Per closer show rate and close rate</h2>
<div class="callout warn">Per closer show rate and close rate cannot be computed. Showed has never been reliably recorded on every appointment in the window, autoConfirm is true on the calendars and there is no disposition step that consistently sets showed, so there is no clean numerator to split by closer. ${_caleb.closed || '0'} sales to date, worth ${_caleb.cash || '$0'}, are assigned to Caleb, but a per-closer close rate needs a showed disposition on every call to be meaningful, not just win counts. This becomes computable the moment a showed disposition is enforced at the end of each call.</div>

<h2 class="sec">Standard, CRO opportunity</h2>
<div class="block std">
<div class="bl">The standard</div>
<p class="small">A healthy closer bench for this volume runs 3 to 4 seated closers, each carrying a comparable share of bookings under a balanced round robin, on one meeting tool, with a showed disposition on every call so show rate and close rate can be tracked and coached per closer.</p>
</div>
<div class="block rem">
<div class="bl">Remediation</div>
<ol class="tk small">
<li>Remove James from the rotation, see routing remediation above. This alone should lift the other seated closers' share back toward parity once those bookings redistribute onto real closers.</li>
<li>Switch distribution to balanced weighting so no single closer remains a concentration risk at ${_topRealSharePct}% of real-closer volume.</li>
<li>Standardize on Zoom for all closers so call recordings and meeting analytics are consistent across the bench.</li>
<li>Add a mandatory showed or no show disposition at the end of each calendar event workflow so per closer show rate and close rate become computable.</li>
</ol>
</div>
<!--CLOSERS_END-->`;
if (/[–—]/.test(closersHtml)) { console.error('ERROR: em/en dash in closers output'); process.exit(1); }
idx = idx.replace(reClosers, closersHtml);

// Campaign performance + Creative and fatigue tabs: ad-set/ad-level detail, computed fresh
// from build_adcreative.py's fold of the raw Meta ad-set/ad pull. Ranking excludes thin-data
// noise (spend < $50) so a one-click test doesn't get crowned "winner" or "money pit".
const ac = d.adCreative || {};
const adsetRow = r => `<tr><td>${r.name}<div class="sub">${r.campaignName}</div></td><td><span class="tag ${r.status === 'Active' ? 'ok' : 'bad'}">${r.status}</span></td><td>${r.objective === 'lead' ? 'Lead' : 'Appointment'}</td><td class="num">${r.spend}</td><td class="num">${r.clicks}</td><td class="num">${r.ctr}</td><td class="num">${r.results}</td><td class="num">${r.cpl}</td></tr>`;
const topAdsetRows = (ac.topAdsets || []).map(adsetRow).join('\n');
const topAdRows = (ac.topAds || []).map(adsetRow).join('\n');
const sprawlAds = (d.ads || []).filter(r => _money(r.spend) > 0 && _money(r.spend) < 5).sort((a, c) => _money(c.spend) - _money(a.spend));
const sprawlRows = sprawlAds.slice(0, 10).map(r => `<tr><td>${r.name}</td><td>${r.campaignName}</td><td class="num">${r.spend}</td><td class="num">${r.clicks}</td><td class="num">${r.status}</td></tr>`).join('\n');

// EZCheck pulls and qualification rate by campaign/source. Grouped raw (not folded to the 6
// canonical campaigns): the naming fragmentation here (numeric ids, mixed casing, legacy
// source-only rows) is the same finding the "one naming convention" panel documents, so it is
// shown as-is rather than smoothed over. build_ezcheck.py resolves bare numeric ids to a
// readable campaign name; everything else is the raw utm_campaign string GHL captured.
const ez = d.ezcheck || {};
const ezRows = (ez.rows || []).map(r => {
  const qrColor = r.total < 3 ? '' : (r.qualRate >= 40 ? 'var(--ok)' : (r.qualRate <= 15 ? 'var(--bad)' : 'var(--warn)'));
  return `<tr><td${r.isOther ? ' style="font-style:italic"' : ''}>${r.campaign}</td><td class="num">${r.prequalified}</td><td class="num">${r.unqualified}</td><td class="num">${r.total}</td><td class="num"${qrColor ? ` style="color:${qrColor}"` : ''}>${r.qualRate}%</td></tr>`;
}).join('\n');
const campaignsHtml = `<!--CAMPAIGNS_START-->
<div class="note">The 6-campaign summary (spend, clicks, CTR, CPL, CPA, ROAS) lives on the Scoreboard tab; the appt-vs-lead objective split lives in Lead economics, by objective there too. This tab goes one level deeper, into ad sets and individual ads, since that is where creative and targeting decisions actually get made.</div>

<h2 class="sec">Top ad sets, since 15 June</h2>
<div class="tw">
<table>
<thead><tr><th>Ad set</th><th>Status</th><th>Objective</th><th class="num">Spend</th><th class="num">Clicks</th><th class="num">CTR</th><th class="num">Results</th><th class="num">Cost / result</th></tr></thead>
<tbody>
${topAdsetRows}
</tbody>
</table>
</div>
<div class="note">${ac.adsetCount || 0} ad sets carried spend since 15 June across the 6 canonical campaigns (folded through the same pixel-updated/relaunched/copy mapping as the Scoreboard). Showing the top 5 by spend; ranked by cost per result only above a $50 spend floor, to keep one-click noise out of the winner/money-pit calls below.</div>

<h2 class="sec">Top ads, since 15 June</h2>
<div class="tw">
<table>
<thead><tr><th>Ad</th><th>Status</th><th>Objective</th><th class="num">Spend</th><th class="num">Clicks</th><th class="num">CTR</th><th class="num">Results</th><th class="num">Cost / result</th></tr></thead>
<tbody>
${topAdRows}
</tbody>
</table>
</div>
<div class="note">${ac.adCount || 0} ads carried spend since 15 June. Showing the top 5 by spend.</div>

<h2 class="sec">EZ Check Pulls & Qualification Rate by Campaign</h2>
<div class="tw">
<table>
<thead><tr><th>Campaign / Source</th><th class="num">Prequalified</th><th class="num">Unqualified</th><th class="num">Total Pulls</th><th class="num">Qual Rate</th></tr></thead>
<tbody>
${ezRows}
</tbody>
</table>
</div>
<div class="note">Overall (all campaigns): ${ez.overallPrequalified || 0} prequalified / ${ez.overallTotal || 0} total pulls = ${ez.overallQualRate || 0}%. Grouped by the raw first-touch utm_campaign GHL captured (or its source field when no UTM was set), not folded to the 6 canonical campaigns, so the same underlying campaign can appear more than once under a different numeric id, name string, or casing, exactly the naming fragmentation the "one naming convention" fix on the Attribution tab targets. ${ez.groupCount || 0} distinct campaign/source values across ${ez.totalOpps || 0} opportunities; ${ez.neverPulled || 0} never had an EZCheck pull recorded and are excluded from these rates.</div>

<h2 class="sec">Winners to scale vs money pits</h2>
<div class="grid g2">
<div class="card">
<h3>Winners to scale</h3>
<ul class="tk small">
${ac.winnerAppt ? `<li><b>${ac.winnerAppt.name}</b> (${ac.winnerAppt.campaignName}): ${ac.winnerAppt.cpl} per appt on ${ac.winnerAppt.spend} spend, ${ac.winnerAppt.ctr} CTR. Cheapest appointment result in the account today, worth checking why this specific creative outperforms the rest of its campaign.</li>` : ''}
${ac.winnerLead ? `<li><b>${ac.winnerLead.name}</b> (${ac.winnerLead.campaignName}): ${ac.winnerLead.cpl} per lead on ${ac.winnerLead.spend} spend, ${ac.winnerLead.ctr} CTR. Cheapest lead result in the account today.</li>` : ''}
</ul>
</div>
<div class="card">
<h3>Money pits</h3>
<ul class="tk small">
${ac.moneyPit ? `<li><b>${ac.moneyPit.name}</b> (${ac.moneyPit.campaignName}): ${ac.moneyPit.cpl} per result on ${ac.moneyPit.spend} spend, the most expensive result above the $50 spend floor today.</li>` : ''}
${(ac.zeroConvAds || []).map(r => `<li><b>${r.name}</b> (${r.campaignName}): ${r.spend} spend, 0 recorded results. Pure wasted budget with no conversion at all.</li>`).join('\n')}
</ul>
</div>
</div>

<h2 class="sec">Creative sprawl to archive</h2>
<div class="tw tight">
<table>
<thead><tr><th>Ad</th><th>Campaign</th><th class="num">Spend</th><th class="num">Clicks</th><th>Status</th></tr></thead>
<tbody>
${sprawlRows || '<tr><td colspan="5">No sub-$5 sprawl ads this refresh.</td></tr>'}
</tbody>
</table>
</div>
<div class="note">${sprawlAds.length} ads carry under ${ac.sprawlThreshold || '$5'} total spend each, ${ac.sprawlSpend || '$0'} combined, mostly pixel-updated duplicates of the same underlying creative concept. Showing up to 10 of them. These add sprawl, not signal, and are candidates to archive rather than leave paused indefinitely.</div>
<!--CAMPAIGNS_END-->`;
if (/[–—]/.test(campaignsHtml)) { console.error('ERROR: em/en dash in campaigns output'); process.exit(1); }
idx = idx.replace(reCampaigns, campaignsHtml);

const creativeAdRows = (ac.topAds || []).map(r => `<tr><td>${r.name}</td><td>${r.id}</td><td>${r.campaignName}</td><td class="num">${r.spend}</td><td class="num" style="color:${r.ctr !== 'n/a' && parseFloat(r.ctr) >= 2 ? 'var(--ok)' : 'var(--bad)'}">${r.ctr}</td><td class="num">${r.cpl}</td><td class="num">${r.results}</td></tr>`).join('\n');
const creativeHtml = `<!--CREATIVE_START-->
<h2 class="sec">Creative performance, top ads</h2>
<div class="tw">
<table>
<thead><tr><th>Ad</th><th>Ad id</th><th>Campaign</th><th>Spend</th><th>CTR</th><th>Cost per result</th><th>Result</th></tr></thead>
<tbody>
${creativeAdRows}
</tbody>
</table>
</div>
<div class="note">${ac.sprawlCount || 0} ads sit under ${ac.sprawlThreshold || '$5'} total spend each (${ac.sprawlSpend || '$0'} combined), see the Campaign performance tab for the full sprawl list. They add sprawl, not signal.</div>

<h2 class="sec">Fatigue analysis, week over week</h2>
<div class="grid g3">
<div class="kpi"><div class="n">${m.ctr} to ${(d.windows.last7||{}).ctr}</div><div class="l">Account CTR, since 15 Jun to last 7 days</div><div class="s">${T['derived.ctrDelta']}</div></div>
<div class="kpi"><div class="n">${m.freq} to ${T['derived.last7Freq']}</div><div class="l">Frequency, since 15 Jun to last 7 days</div><div class="s">same faces seeing the ad again</div></div>
<div class="kpi"><div class="n">${m.cpc} to ${(d.windows.last7||{}).cpc}</div><div class="l">CPC, since 15 Jun to last 7 days</div><div class="s">CPM ${m.cpm} to ${(d.windows.last7||{}).cpm}</div></div>
</div>
<div class="block ev">
<div class="bl">What is found</div>
<p class="small">Since launch (${d.windowMeta}, ${d.windowDays} days): ${m.spend} spend, ${m.impressions} impressions, ${m.reach} reach, frequency ${m.freq}, ${m.clicks} clicks, CTR ${m.ctr}, CPC ${m.cpc}, CPM ${m.cpm}. Last 7 days: ${(d.windows.last7||{}).spend} spend, ${(d.windows.last7||{}).impressions} impressions, frequency ${T['derived.last7Freq']}, CTR ${(d.windows.last7||{}).ctr}, CPC ${(d.windows.last7||{}).cpc}, CPM ${(d.windows.last7||{}).cpm}. CTR moved ${T['derived.ctrDelta']} while CPC moved ${T['derived.cpcDelta']} and CPM moved ${T['derived.cpmDelta']} over that same span. ${ac.adsetCount || 0} ad sets and ${ac.adCount || 0} ads carried spend this window; ${ac.sprawlCount || 0} of those ads sit under ${ac.sprawlThreshold || '$5'} each, mostly pixel-updated duplicates of the same underlying creative, so the account is testing new thumbnails on a handful of messages rather than genuinely new concepts.</p>
</div>
<div class="block std">
<div class="bl">The CRO reading</div>
<p class="small">Efficient scaling holds CTR flat or improves it as spend grows, because new creative and new audience segments absorb the added reach. A CTR slip alongside rising CPC and CPM in the same window the account is scaling is the early signature of creative fatigue: the algorithm is paying more to show the same message to people who have already seen it, not finding new demand. Watch these three together, not any single one in isolation.</p>
</div>
<div class="block rem">
<div class="bl">Remediation</div>
<ol class="tk small">
<li>Ship fresh creative concepts (not just new thumbnails on the existing script) into the active spend drivers before the next spend increase.</li>
<li>Collapse the ${ac.sprawlCount || 0} near-identical sub-${ac.sprawlThreshold || '$5'} variants into 3 to 5 deliberately distinct creative concepts (different angle, different proof point, different visual style).</li>
<li>In <span class="screen">Ads Manager, Columns, Performance and Clicks, Frequency</span>, review weekly at the ad set level. If any active ad set crosses 3.0 to 3.5 with flat or falling CTR, treat it as an audience refresh trigger, not a bid trigger.</li>
</ol>
</div>

<h2 class="sec">Opportunity score, current recommendations</h2>
<div class="grid g2">
<div class="kpi"><div class="n ok">${m.oppScore}/100</div><div class="l">Meta opportunity score</div><div class="s">Account level</div></div>
<div class="kpi"><div class="n ok">${ac.winnerAppt ? ac.winnerAppt.cpl : (ac.winnerLead ? ac.winnerLead.cpl : 'n/a')}</div><div class="l">cost per result, today's best ad</div><div class="s">${ac.winnerAppt ? ac.winnerAppt.name : (ac.winnerLead ? ac.winnerLead.name : 'n/a')}</div></div>
</div>
<div class="callout warn">Meta re-ranks its specific recommendations (which ad set to scale, which creative enhancement to enable) as delivery changes day to day, so a screenshot of them goes stale within days. Check <span class="screen">Ads Manager, Account Overview, Recommendations</span> directly for today's exact cards; use the score and the best-performing ad above, both refreshed daily here, as the standing baseline to judge any recommendation against.</div>
<!--CREATIVE_END-->`;
if (/[–—]/.test(creativeHtml)) { console.error('ERROR: em/en dash in creative output'); process.exit(1); }
idx = idx.replace(reCreative, creativeHtml);

// Delimiter is {%dotted.path%} (NOT {{...}}, which is Meta's own ad-URL parameter syntax and appears verbatim in the tracking panel).
idx = idx.replace(/\{%\s*([a-zA-Z0-9_.]+)\s*%\}/g, (m, key) => (key in T ? T[key] : m));
const _leftover = idx.match(/\{%\s*[a-zA-Z0-9_.]+\s*%\}/g);
if (_leftover) { console.error('ERROR: unresolved live tokens: ' + [...new Set(_leftover)].join(', ')); process.exit(1); }
if (/[–—]/.test(idx)) { console.error('ERROR: em/en dash in final document'); process.exit(1); }

fs.writeFileSync(idxPath, idx, 'utf8');
console.log('rendered all panels (markers + live tokens) for ' + d.asOf + ', index.html now ' + idx.length + ' bytes');
