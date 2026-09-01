#!/usr/bin/env node
// bq.js — minimal BigQuery SQL runner using the service-account key.
// Usage:  node bq.js "SELECT 1"          (inline SQL)
//         node bq.js path/to/file.sql    (SQL file)
// No npm dependencies — signs the JWT with node's built-in crypto.

const fs = require("fs");
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
  const sig = b64url(signer.sign(key.private_key));
  const jwt = `${header}.${claims}.${sig}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=${encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer")}&assertion=${jwt}`,
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("token error: " + JSON.stringify(data));
  return data.access_token;
}

async function runQuery(sql) {
  const token = await getAccessToken();
  const res = await fetch(`https://bigquery.googleapis.com/bigquery/v2/projects/${key.project_id}/queries`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql, useLegacySql: false, timeoutMs: 120000, maxResults: 1000 }),
  });
  const data = await res.json();
  if (data.error) {
    console.error("ERROR:", JSON.stringify(data.error, null, 2));
    process.exit(1);
  }
  if (!data.jobComplete) {
    console.error("Job did not complete within timeout. jobId:", data.jobReference?.jobId);
    process.exit(1);
  }
  if (data.schema && data.rows) {
    const fields = data.schema.fields.map(f => f.name);
    console.log(fields.join("\t"));
    for (const r of data.rows) {
      console.log(r.f.map(c => (c.v === null ? "NULL" : c.v)).join("\t"));
    }
    console.log(`\n(${data.totalRows} rows)`);
  } else {
    console.log("OK — statement(s) executed, no result rows.");
    if (data.numDmlAffectedRows) console.log("DML affected rows:", data.numDmlAffectedRows);
  }
}

const arg = process.argv[2];
if (!arg) { console.error("usage: node bq.js <sql-or-file>"); process.exit(1); }
const sql = fs.existsSync(arg) ? fs.readFileSync(arg, "utf8") : arg;
runQuery(sql).catch(e => { console.error(e.message); process.exit(1); });
