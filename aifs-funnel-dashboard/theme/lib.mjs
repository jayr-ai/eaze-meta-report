// theme/lib.mjs — OKLCH color engine for brand-color-driven theming.
// Math adapted from the dataviz skill's validate_palette.js (Björn Ottosson's OKLab,
// Machado/Oliveira/Fernandes 2009 CVD simulation) but self-contained here — this file
// must keep working standalone in this project long after any skill session ends.

// ── thresholds (mirrors the dataviz skill's rules) ──────────────────────────
export const BAND = { light: [0.43, 0.77], dark: [0.48, 0.67] };
export const CHROMA_FLOOR = 0.10;
export const CONTRAST_MIN = 3.0;

const MACHADO = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
};

// ── hex <-> linear sRGB <-> OKLab/OKLCH ─────────────────────────────────────
const hex2srgb = (h) => { h = h.trim().replace(/^#/, ""); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255); };
const s2lin = (c) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
const lin2s = (c) => { c = Math.max(0, Math.min(1, c)); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; };
const lin = (h) => hex2srgb(h).map(s2lin);
const relLum = (h) => { const [r, g, b] = lin(h); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const contrast = (a, b) => { const [hi, lo] = [relLum(a), relLum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

function rgb2oklab(r, g, b) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
}
function oklab2rgbLinear(L, a, b) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
}
export function hex2oklab(h) { return rgb2oklab(...lin(h)); }
export function hex2oklch(h) {
  const [L, a, b] = hex2oklab(h);
  const C = Math.hypot(a, b);
  const H = ((Math.atan2(b, a) * 180 / Math.PI) % 360 + 360) % 360;
  return [L, C, H];
}
function inGamut(r, g, b) { return r >= -0.0005 && r <= 1.0005 && g >= -0.0005 && g <= 1.0005 && b >= -0.0005 && b <= 1.0005; }
export function oklch2hex(L, C, H) {
  const hRad = H * Math.PI / 180;
  let c = C;
  for (let i = 0; i < 24; i++) {
    const a = c * Math.cos(hRad), b = c * Math.sin(hRad);
    const [r, g, b2] = oklab2rgbLinear(L, a, b);
    if (inGamut(r, g, b2) || c < 0.002) {
      const toByte = (x) => Math.round(Math.max(0, Math.min(1, lin2s(x))) * 255);
      return "#" + [r, g, b2].map(toByte).map(v => v.toString(16).padStart(2, "0")).join("");
    }
    c *= 0.93; // reduce chroma until in-gamut
  }
  return "#808080";
}

// ── CIELAB ΔE (with optional CVD simulation) — for colorblind-safe separation ──
function lin2lab(r, g, b) {
  const X = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b;
  const Y = 0.2126729 * r + 0.7151522 * g + 0.0721750 * b;
  const Z = 0.0193339 * r + 0.1191920 * g + 0.9503041 * b;
  const f = (t) => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  const [fx, fy, fz] = [f(X / 0.95047), f(Y / 1.0), f(Z / 1.08883)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
function simulateCVD(h, kind) {
  const [r, g, b] = lin(h), M = MACHADO[kind];
  const clamp = (x) => Math.max(0, Math.min(1, x));
  return [clamp(M[0][0] * r + M[0][1] * g + M[0][2] * b), clamp(M[1][0] * r + M[1][1] * g + M[1][2] * b), clamp(M[2][0] * r + M[2][1] * g + M[2][2] * b)];
}
export function deltaE(h1, h2, kind) {
  const a = lin2lab(...(kind ? simulateCVD(h1, kind) : lin(h1)));
  const b = lin2lab(...(kind ? simulateCVD(h2, kind) : lin(h2)));
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}
export function worstCvdDeltaE(h1, h2) {
  return Math.min(deltaE(h1, h2, "protan"), deltaE(h1, h2, "deutan"));
}

// ── categorical-pair validation (2-slot subset of the skill's `validate`) ────
export function validatePair(hexA, hexB, mode, surface) {
  const [lo, hi] = BAND[mode];
  const report = [];
  let ok = true;
  for (const h of [hexA, hexB]) {
    const [L, C] = hex2oklch(h);
    if (L < lo || L > hi) { ok = false; report.push(`${h} lightness ${L.toFixed(3)} outside band ${lo}-${hi}`); }
    if (C < CHROMA_FLOOR) { ok = false; report.push(`${h} chroma ${C.toFixed(3)} below floor ${CHROMA_FLOOR}`); }
  }
  const wd = worstCvdDeltaE(hexA, hexB);
  const cvdState = wd >= 12 ? "pass" : wd >= 8 ? "floor (needs direct labels)" : "FAIL";
  if (wd < 8) ok = false;
  report.push(`CVD ΔE ${wd.toFixed(1)} (${cvdState})`);
  for (const h of [hexA, hexB]) {
    const cr = contrast(h, surface);
    report.push(`${h} contrast vs surface ${cr.toFixed(2)}:1${cr < CONTRAST_MIN ? " (relief: needs visible labels)" : ""}`);
  }
  return { ok, report };
}

// ── brand-color -> validated theme derivation ────────────────────────────────
function snapToBand(L, mode) {
  const [lo, hi] = BAND[mode];
  return Math.max(lo, Math.min(hi, L));
}

/** Derive series-1 (the brand color itself, band-snapped for the mode). */
export function deriveSeries1(brandHex, mode) {
  const [L, C, H] = hex2oklch(brandHex);
  const L2 = snapToBand(L, mode);
  const C2 = Math.max(C, CHROMA_FLOOR + 0.02);
  return oklch2hex(L2, C2, H);
}

/** Derive series-2 by searching hue rotations for the best colorblind-safe partner. */
export function deriveSeries2(brandHex, mode) {
  const [, C0, H0] = hex2oklch(brandHex);
  const [lo, hi] = BAND[mode];
  const L = (lo + hi) / 2;
  const C = Math.max(C0, CHROMA_FLOOR + 0.03);
  const s1 = deriveSeries1(brandHex, mode);
  let best = null;
  for (let offset = 60; offset <= 300; offset += 5) {
    const H = (H0 + offset) % 360;
    const cand = oklch2hex(L, C, H);
    const wd = worstCvdDeltaE(s1, cand);
    if (!best || wd > best.wd) best = { wd, hex: cand, offset };
  }
  return best.hex;
}

/** Generate a light->dark gradient ramp along the brand hue (for area/hero charts). */
export function deriveRamp(brandHex, steps = 5, lFrom = 0.90, lTo = 0.38) {
  const [, C0, H0] = hex2oklch(brandHex);
  const C = Math.max(C0, 0.12);
  const out = [];
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    out.push(oklch2hex(lFrom + (lTo - lFrom) * t, C, H0));
  }
  return out;
}

/** Tint a near-black/near-white surface toward the brand hue at low chroma. */
export function tintSurface(brandHex, L, chroma) {
  const [, , H] = hex2oklch(brandHex);
  return oklch2hex(L, chroma, H);
}
