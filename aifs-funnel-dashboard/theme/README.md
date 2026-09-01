# Reskinning this dashboard for a new business

This dashboard's entire color identity comes from **one brand hex code**. Nothing
else in `public/index.html` needs to change to reskin it.

## To reskin an existing clone

```
node theme/build-theme.mjs "#RRGGBB" "Business Name"
railway up --service <service-name> --detach
```

That's it. The script:

1. Derives a colorblind-safe 2-color categorical palette (Ads/Organic series) —
   your brand color becomes series 1; a partner hue is auto-searched and
   validated for CVD separation (checked against protanopia/deuteranopia
   simulation, not eyeballed).
2. Derives brand-tinted dark and light surfaces (the deep indigo-black look) and
   a light→dark gradient ramp for the hero chart.
3. Writes `theme/themes/<slug>.json` (a record of what was generated) and
   `public/theme.css` (what the page actually loads).
4. Prints a validation report — if a check lands in the WARN/floor band, it says
   so; it still writes the CSS (WARN bands are legal with the dashboard's
   existing direct-labels/legend, per the design system's own rules), but a hard
   FAIL means pick a different brand hex or run it again — it won't happen with
   normal brand colors, only with something already very low-contrast or
   desaturated.

## What never changes, regardless of brand

Status colors (`good` = green, `warning` = amber, `critical` = red) are **fixed**
in `build-theme.mjs`, not derived from the brand hex. This is a deliberate rule,
not an oversight: if "Flag" bullets turned brand-purple for one client and
brand-blue for another, red/amber/green would stop meaning the same thing across
every dashboard in the portfolio. Never edit the `STATUS` constant per business.

## Cloning to a whole new business (not just recoloring)

1. Copy this folder (`aifs-funnel-dashboard/`) to a new folder.
2. Update `bake.js`'s BigQuery view names/dataset for the new business's warehouse.
3. Run the reskin command above with that business's brand hex.
4. `railway init` a new project, `railway up`, `railway domain`.

Steps 2-4 are the same "first source → views → dashboard" pattern already
documented in the AIFS warehouse rebuild — this file only covers the color layer.

## Manual override

If you ever want the palette to NOT be brand-derived for a specific business
(e.g. a client mandates exact hex values from their own brand guide for both
series, not just the primary), hand-edit `public/theme.css` directly instead of
running the generator — just re-run `node <path-to-skill>/validate_palette.js`
against your two hexes first to confirm CVD/contrast still pass.
