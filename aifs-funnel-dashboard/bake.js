#!/usr/bin/env node
// bake.js — pulls the AIFS funnel views from BigQuery and bakes public/data.json.
// Runs locally (needs the service-account key); Railway only ever sees the baked JSON.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const KEY_PATH = "C:/Users/Jayvee D Billionaire/.gcp/jv-data-warehouse-key.json";
const key = JSON.parse(fs.readFileSync(KEY_PATH, "utf8"));

function b64url(buf) {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({
    iss: key.client_email,
    scope: "https://www.googleapis.com/auth/bigquery",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const jwt = `${header}.${claims}.${b64url(signer.sign(key.private_key))}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=${encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer")}&assertion=${jwt}`,
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("token error: " + JSON.stringify(data));
  return data.access_token;
}

async function query(token, sql) {
  const res = await fetch(`https://bigquery.googleapis.com/bigquery/v2/projects/${key.project_id}/queries`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql, useLegacySql: false, timeoutMs: 120000, maxResults: 5000 }),
  });
  const data = await res.json();
  if (data.error) throw new Error(JSON.stringify(data.error));
  if (!data.jobComplete) throw new Error("query did not complete in time");
  const fields = data.schema.fields;
  return (data.rows || []).map(r => {
    const obj = {};
    r.f.forEach((c, i) => {
      const f = fields[i];
      let v = c.v;
      if (v !== null && (f.type === "FLOAT" || f.type === "NUMERIC" || f.type === "INTEGER" || f.type === "BIGNUMERIC")) {
        v = Number(v);
      }
      obj[f.name] = v;
    });
    return obj;
  });
}

async function main() {
  const token = await getAccessToken();
  const daily = await query(token, `
    SELECT * FROM \`jv-data-warehouse.ai_funding.v_daily_funnel\` ORDER BY date`);
  const weekly = await query(token, `
    SELECT * FROM \`jv-data-warehouse.ai_funding.v_weekly_funnel\` ORDER BY week_start`);

  const out = {
    generated_at: new Date().toISOString(),
    data_through: daily.length ? daily[daily.length - 1].date : null,
    daily,
    weekly,
  };
  const outPath = path.join(__dirname, "public", "data.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 1));
  console.log(`Baked ${daily.length} daily rows, ${weekly.length} weekly rows -> ${outPath}`);
  console.log(`Data through: ${out.data_through}`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
