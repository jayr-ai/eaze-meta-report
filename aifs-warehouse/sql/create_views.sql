-- AIFS warehouse — views layer (overall performance, no media-buyer segmentation)
-- Raw metrics are only ever SUMmed; every ratio is recomputed from summed raws.

-- 0. Clean up buyer-segmentation-era objects if they exist
DROP VIEW IF EXISTS `jv-data-warehouse.ai_funding.v_weekly_summary`;
DROP VIEW IF EXISTS `jv-data-warehouse.ai_funding.v_daily_cash`;
DROP VIEW IF EXISTS `jv-data-warehouse.ai_funding.v_weekly_funnel`;
DROP VIEW IF EXISTS `jv-data-warehouse.ai_funding.v_daily_funnel`;
DROP TABLE IF EXISTS `jv-data-warehouse.ai_funding.dim_campaign`;

-- 1. Daily funnel — one row per day, whole business
CREATE OR REPLACE VIEW `jv-data-warehouse.ai_funding.v_daily_funnel` AS
WITH meta_daily AS (
  SELECT
    date,
    SUM(spend)              AS spend,
    SUM(impressions)        AS impressions,
    SUM(reach)              AS reach,
    SUM(clicks)             AS clicks,
    SUM(landing_page_views) AS landing_page_views
  FROM `jv-data-warehouse.ai_funding.meta_ad`
  GROUP BY 1
),
ghl_daily AS (
  SELECT
    created_date AS date,
    COUNT(*)                                   AS leads_total,
    COUNTIF(attribution_channel = 'Ads')       AS leads_ads,
    COUNTIF(attribution_channel = 'Organic')   AS leads_organic,
    COUNTIF(is_call_booked)                    AS calls_booked,
    COUNTIF(is_no_show)                        AS no_shows,
    COUNTIF(is_closed_won)                     AS sales
  FROM `jv-data-warehouse.ai_funding.ghl_opportunity`
  GROUP BY 1
),
cash_daily AS (
  SELECT
    charge_date AS date,
    SUM(amount - amount_refunded) AS cash_collected,
    COUNT(*)                      AS payments
  FROM `jv-data-warehouse.ai_funding.stripe_charge`
  WHERE status = 'succeeded'
    AND paid
    AND amount >= 1.00          -- excludes $0.50 card-test charges
    AND amount_refunded < amount
  GROUP BY 1
)
SELECT
  COALESCE(m.date, g.date, c.date) AS date,
  IFNULL(m.spend, 0)              AS spend,
  IFNULL(m.impressions, 0)        AS impressions,
  IFNULL(m.reach, 0)              AS reach,
  IFNULL(m.clicks, 0)             AS clicks,
  IFNULL(m.landing_page_views, 0) AS landing_page_views,
  IFNULL(g.leads_total, 0)        AS leads_total,
  IFNULL(g.leads_ads, 0)          AS leads_ads,
  IFNULL(g.leads_organic, 0)      AS leads_organic,
  IFNULL(g.calls_booked, 0)       AS calls_booked,
  IFNULL(g.no_shows, 0)           AS no_shows,
  IFNULL(g.sales, 0)              AS sales,
  IFNULL(c.cash_collected, 0)     AS cash_collected,
  IFNULL(c.payments, 0)           AS payments,
  ROUND(SAFE_DIVIDE(m.spend, m.impressions) * 1000, 2)       AS cpm,
  ROUND(SAFE_DIVIDE(m.spend, m.clicks), 2)                   AS cpc,
  ROUND(SAFE_DIVIDE(m.clicks, m.impressions) * 100, 2)       AS ctr_pct,
  ROUND(SAFE_DIVIDE(g.leads_total, m.clicks) * 100, 2)       AS click_to_lead_pct,
  ROUND(SAFE_DIVIDE(m.spend, g.leads_ads), 2)                AS cost_per_lead,
  ROUND(SAFE_DIVIDE(m.spend, g.calls_booked), 2)             AS cost_per_booked_call,
  ROUND(SAFE_DIVIDE(g.calls_booked, g.leads_total) * 100, 2) AS lead_to_call_pct,
  ROUND(SAFE_DIVIDE(m.clicks, g.calls_booked), 1)            AS clicks_per_booked_call,
  ROUND(SAFE_DIVIDE(g.no_shows, g.calls_booked) * 100, 2)    AS no_show_rate_pct,
  ROUND(SAFE_DIVIDE(m.spend, g.sales), 2)                    AS cpa,
  ROUND(SAFE_DIVIDE(c.cash_collected, g.sales), 2)           AS aov,
  ROUND(SAFE_DIVIDE(c.cash_collected, m.spend), 2)           AS roas
FROM meta_daily m
FULL OUTER JOIN ghl_daily  g ON m.date = g.date
FULL OUTER JOIN cash_daily c ON COALESCE(m.date, g.date) = c.date;

-- 2. Weekly funnel — SUM raws, THEN recompute ratios (weeks start Sunday)
CREATE OR REPLACE VIEW `jv-data-warehouse.ai_funding.v_weekly_funnel` AS
SELECT
  DATE_TRUNC(date, WEEK(SUNDAY)) AS week_start,
  SUM(spend)              AS spend,
  SUM(impressions)        AS impressions,
  SUM(reach)              AS reach,
  SUM(clicks)             AS clicks,
  SUM(landing_page_views) AS landing_page_views,
  SUM(leads_total)        AS leads_total,
  SUM(leads_ads)          AS leads_ads,
  SUM(leads_organic)      AS leads_organic,
  SUM(calls_booked)       AS calls_booked,
  SUM(no_shows)           AS no_shows,
  SUM(sales)              AS sales,
  SUM(cash_collected)     AS cash_collected,
  SUM(payments)           AS payments,
  ROUND(SAFE_DIVIDE(SUM(spend), SUM(impressions)) * 1000, 2)      AS cpm,
  ROUND(SAFE_DIVIDE(SUM(spend), SUM(clicks)), 2)                  AS cpc,
  ROUND(SAFE_DIVIDE(SUM(clicks), SUM(impressions)) * 100, 2)      AS ctr_pct,
  ROUND(SAFE_DIVIDE(SUM(leads_total), SUM(clicks)) * 100, 2)      AS click_to_lead_pct,
  ROUND(SAFE_DIVIDE(SUM(spend), SUM(leads_ads)), 2)               AS cost_per_lead,
  ROUND(SAFE_DIVIDE(SUM(spend), SUM(calls_booked)), 2)            AS cost_per_booked_call,
  ROUND(SAFE_DIVIDE(SUM(calls_booked), SUM(leads_total)) * 100, 2) AS lead_to_call_pct,
  ROUND(SAFE_DIVIDE(SUM(clicks), SUM(calls_booked)), 1)           AS clicks_per_booked_call,
  ROUND(SAFE_DIVIDE(SUM(no_shows), SUM(calls_booked)) * 100, 2)   AS no_show_rate_pct,
  ROUND(SAFE_DIVIDE(SUM(spend), SUM(sales)), 2)                   AS cpa,
  ROUND(SAFE_DIVIDE(SUM(cash_collected), SUM(sales)), 2)          AS aov,
  ROUND(SAFE_DIVIDE(SUM(cash_collected), SUM(spend)), 2)          AS roas
FROM `jv-data-warehouse.ai_funding.v_daily_funnel`
GROUP BY 1;
