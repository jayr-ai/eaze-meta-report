const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Optional local-only .env loader (no dependency, mirrors house style of process.env-only config).
// Railway injects real env vars directly, so this is a no-op in production.
(function loadDotEnvIfPresent() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = val;
  }
})();

const PORT = process.env.PORT || 3000;
const DATASET_ID = process.env.DATASET_ID;
const DATASET_TOKEN = process.env.DATASET_TOKEN;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const GRAPH_VERSION = process.env.GRAPH_API_VERSION || 'v21.0';

// event_source_url just needs to be a real URL on the verified domain — Meta doesn't use it
// for attribution (the UTM->GHL join is the referee), so we build it from whatever page slug
// is in the webhook path, with the actual GHL page URL preferred if the payload includes one.
const DEFAULT_DOMAIN = process.env.DEFAULT_DOMAIN || 'go.aifundingsolutions.com';

const EVENTS = {
  'booked-qualified': 'DBReviewCall_Booked_Qualified',
  'showed': 'DBReviewCall_Call_Showed',
  'cancelled': 'DBReviewCall_Call_Cancelled',
  'opportunity-identified': 'DBReviewCall_Opportunity_Identified',
  'install-signed': 'DBReviewCall_Install_Signed',
  'case-funded': 'DBReviewCall_Case_Funded',
};

function sha256Lower(value) {
  return crypto.createHash('sha256').update(String(value).trim().toLowerCase()).digest('hex');
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function extractEmail(payload) {
  return (
    payload.email ||
    (payload.contact && payload.contact.email) ||
    payload['contact.email'] ||
    null
  );
}

function extractAppointmentId(payload) {
  return (
    payload.appointment_id ||
    payload.id ||
    (payload.appointment && payload.appointment.id) ||
    null
  );
}

// GHL's "Test workflow" button enrolls placeholder contacts with no real appointment
// record, which renders unresolved merge fields as the literal text "null"/"undefined"
// (or leaves the {{merge_field}} tag unresolved) instead of omitting the key — all of
// these are truthy strings, so a plain falsy check on appointmentId won't catch them.
function isInvalidAppointmentId(value) {
  if (value === null || value === undefined) return true;
  const str = String(value).trim().toLowerCase();
  return str === '' || str === 'null' || str === 'undefined' || str.includes('{{');
}

function extractPageUrl(payload, slug) {
  return (
    payload.page_url ||
    payload.url ||
    payload.funnel_url ||
    payload.source_url ||
    `https://${DEFAULT_DOMAIN}/${slug}`
  );
}

async function sendToMeta(context, eventName, payload) {
  const email = extractEmail(payload);
  if (!email) {
    throw Object.assign(new Error('no email found in webhook payload'), { statusCode: 422 });
  }

  const rawAppointmentId = extractAppointmentId(payload);
  const appointmentId = isInvalidAppointmentId(rawAppointmentId) ? null : rawAppointmentId;
  if (rawAppointmentId !== null && appointmentId === null) {
    console.warn(`[${context}] invalid appointment_id ("${rawAppointmentId}") — likely a test enrollment, falling back to random event_id`);
  }
  const eventId = appointmentId ? `${context}-${appointmentId}` : crypto.randomUUID();

  const event = {
    event_name: eventName,
    event_time: Math.floor(Date.now() / 1000),
    action_source: 'website',
    event_source_url: extractPageUrl(payload, context),
    event_id: eventId,
    user_data: {
      em: [sha256Lower(email)],
    },
  };

  const body = new URLSearchParams({
    access_token: DATASET_TOKEN,
    data: JSON.stringify([event]),
  });

  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${DATASET_ID}/events`, {
    method: 'POST',
    body,
  });
  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw Object.assign(new Error(`Meta CAPI error: ${JSON.stringify(json)}`), { statusCode: 502 });
  }

  return { eventId, meta: json };
}

function checkSecret(req, url) {
  if (!WEBHOOK_SECRET) return true; // not configured yet — allow through during initial setup
  const headerSecret = req.headers['x-webhook-secret'];
  const querySecret = url.searchParams.get('key');
  return headerSecret === WEBHOOK_SECRET || querySecret === WEBHOOK_SECRET;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }

  const match = url.pathname.match(/^\/webhook\/([a-z0-9-]+)\/([a-z0-9-]+)$/);
  if (match) {
    const [, eventSlug, context] = match;
    const eventName = EVENTS[eventSlug];
    if (!eventName) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('not found');
      return;
    }

    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'text/plain' });
      res.end('method not allowed');
      return;
    }

    if (!checkSecret(req, url)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'invalid or missing webhook secret' }));
      return;
    }

    let payload;
    try {
      payload = JSON.parse(await readBody(req));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'invalid JSON body' }));
      return;
    }

    try {
      const result = await sendToMeta(context, eventName, payload);
      console.log(`[${eventSlug}/${context}] sent ${eventName} event_id=${result.eventId}`, result.meta);
      // Always 200 to GHL once accepted, even if Meta rejects — logged above for debugging,
      // so a bad payload doesn't trigger GHL's webhook retry storm.
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, eventId: result.eventId }));
    } catch (e) {
      console.error(`[${eventSlug}/${context}] failed to forward event:`, e.message);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('not found');
});

server.listen(PORT, () => {
  console.log('AIFS L3 middleware on ' + PORT);
  if (!DATASET_ID || !DATASET_TOKEN) {
    console.warn('WARNING: DATASET_ID / DATASET_TOKEN not set — events will fail until configured.');
  }
  if (!WEBHOOK_SECRET) {
    console.warn('WARNING: WEBHOOK_SECRET not set — endpoints are unauthenticated.');
  }
});
