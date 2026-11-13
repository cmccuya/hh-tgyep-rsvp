interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  run(): Promise<unknown>;
  all<T>(): Promise<{ results: T[] }>;
}

interface D1Database {
  prepare(query: string): D1Statement;
}

interface Env {
  DB: D1Database;
  SHEET_TAB: string;
  GOOGLE_SHEET_ID?: string;
  GOOGLE_CLIENT_EMAIL?: string;
  GOOGLE_PRIVATE_KEY?: string;
  VISITS_KEY?: string;
}

type Reply = {
  guestId: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  blockLot: string;
  coming: "yes" | "no";
  guests: string;
  potluck: string;
  suggestions: string;
};

const COLUMNS = [
  "guest_id",
  "name",
  "block_lot",
  "coming",
  "guests",
  "potluck",
  "suggestions",
  "created_at",
  "updated_at",
];

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }));
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/visit") {
      return cors(await recordVisit(request, env));
    }
    if (request.method === "GET" && url.pathname === "/visits") {
      return visitLog(request, env, url);
    }
    if (request.method !== "POST" || url.pathname !== "/rsvp") {
      return cors(json({ error: "Not found" }, 404));
    }
    const reply = await readReply(request);
    if (!reply) return cors(json({ error: "Check the reply and try again." }, 400));

    await env.DB.prepare(
      `INSERT INTO rsvps (guest_id, name, block_lot, coming, guests, potluck, suggestions, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(guest_id) DO UPDATE SET
         name = excluded.name,
         block_lot = excluded.block_lot,
         coming = excluded.coming,
         guests = excluded.guests,
         potluck = excluded.potluck,
         suggestions = excluded.suggestions,
         updated_at = excluded.updated_at`,
    )
      .bind(
        reply.guestId,
        reply.name,
        reply.blockLot,
        reply.coming,
        reply.guests,
        reply.potluck,
        reply.suggestions,
        reply.createdAt,
        reply.updatedAt,
      )
      .run();

    let sheet: "updated" | "unavailable" = "unavailable";
    try {
      if (env.GOOGLE_SHEET_ID && env.GOOGLE_CLIENT_EMAIL && env.GOOGLE_PRIVATE_KEY) {
        await upsertSheet(env, reply);
        sheet = "updated";
      }
    } catch {
      sheet = "unavailable";
    }

    return cors(json({ ok: true, guestId: reply.guestId, sheet }));
  },
};

async function recordVisit(request: Request, env: Env) {
  const ip = request.headers.get("cf-connecting-ip") || "Unknown";
  const agent = request.headers.get("user-agent") || "";
  const { device, browser } = describeAgent(agent);
  const cf = (request as Request & { cf?: { city?: string; region?: string; country?: string } }).cf;
  const place = [cf?.city, cf?.region || cf?.country].filter(Boolean).join(", ") || "Unknown";
  const seen = new Date().toISOString();
  const report = await readStay(request);
  let previous = 0;
  let isNew = true;
  if (report.sessionId) {
    const found = await env.DB.prepare(
      "SELECT reported_seconds FROM visit_sessions WHERE session_id = ?",
    )
      .bind(report.sessionId)
      .all<{ reported_seconds: number }>();
    if (found.results[0]) {
      previous = found.results[0].reported_seconds;
      isNew = false;
    }
    const next = Math.max(previous, report.seconds);
    await env.DB.prepare(
      `INSERT INTO visit_sessions (session_id, ip, reported_seconds)
       VALUES (?, ?, ?)
       ON CONFLICT(session_id) DO UPDATE SET
         reported_seconds = excluded.reported_seconds,
         ip = excluded.ip`,
    )
      .bind(report.sessionId, ip, next)
      .run();
    report.seconds = next - previous;
  }
  const addedVisits = isNew ? 1 : 0;
  await env.DB.prepare(
    `INSERT INTO visits (ip, device, browser, place, visits, duration_seconds, last_seen)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(ip) DO UPDATE SET
       device = excluded.device,
       browser = excluded.browser,
       place = excluded.place,
       visits = visits.visits + ?,
       duration_seconds = visits.duration_seconds + ?,
       last_seen = excluded.last_seen`,
  )
    .bind(
      ip,
      device,
      browser,
      place,
      addedVisits,
      report.seconds,
      seen,
      addedVisits,
      report.seconds,
    )
    .run();
  return json({ ok: true });
}

async function readStay(request: Request) {
  try {
    const body = JSON.parse(await request.text()) as { sessionId?: unknown; seconds?: unknown };
    const sessionId = typeof body.sessionId === "string" ? body.sessionId.slice(0, 80) : "";
    const seconds = Math.min(14400, Math.max(0, Math.round(Number(body.seconds) || 0)));
    if (!/^[0-9a-f-]{36}$/i.test(sessionId)) return { sessionId: "", seconds: 0 };
    return { sessionId, seconds };
  } catch {
    return { sessionId: "", seconds: 0 };
  }
}

function describeAgent(agent: string) {
  const browser = /Edg\/|EdgiOS\//.test(agent)
    ? "Edge"
    : /OPR\/|Opera/.test(agent)
      ? "Opera"
      : /CriOS\/|Chrome\//.test(agent)
        ? "Chrome"
        : /FxiOS\/|Firefox\//.test(agent)
          ? "Firefox"
          : /Safari\//.test(agent)
            ? "Safari"
            : "Browser";
  const device = /iPhone/.test(agent)
    ? "iPhone"
    : /iPad/.test(agent)
      ? "iPad"
      : /Android/.test(agent)
        ? "Smartphone"
        : "Desktop";
  return { device, browser };
}

async function visitLog(request: Request, env: Env, url: URL) {
  const key = url.searchParams.get("key") || "";
  if (!env.VISITS_KEY || key !== env.VISITS_KEY) return json({ error: "Not found" }, 404);
  const listed = await env.DB.prepare(
    "SELECT device, browser, place, ip, visits, duration_seconds, last_seen FROM visits ORDER BY last_seen DESC",
  ).all<{
    device: string;
    browser: string;
    place: string;
    ip: string;
    visits: number;
    duration_seconds: number;
    last_seen: string;
  }>();
  const rows = listed.results
    .map((visit) => {
      const when = new Date(visit.last_seen).toLocaleTimeString("en-US", {
        timeZone: "Asia/Manila",
        hour: "numeric",
        minute: "2-digit",
      });
      const count = `${visit.visits} visit${visit.visits === 1 ? "" : "s"}`;
      const stay = formatStay(visit.duration_seconds || 0);
      return `<article class="row">
        <div>
          <strong>${escapeHtml(visit.device)} · ${escapeHtml(visit.browser)}</strong>
          <p>${escapeHtml(visit.place)}</p>
          <p>IP: ${escapeHtml(visit.ip)}</p>
          <p>${escapeHtml(count)} · ${escapeHtml(stay)}</p>
        </div>
        <time>${escapeHtml(when)}</time>
      </article>`;
    })
    .join("");
  const body = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Hamana Homes Visitor Logs</title>
  <style>
    body { margin: 0; background: #f6f4ef; color: #241c17; font: 16px/1.4 Arial, sans-serif; }
    main { max-width: 720px; margin: 2rem auto; background: #fff; border: 1px solid #e6e0d6; border-radius: 16px; padding: 1.25rem 1.4rem 0.4rem; }
    h1 { margin: 0 0 1rem; font-size: 1.35rem; }
    .row { display: flex; justify-content: space-between; gap: 1rem; border-top: 1px solid #eee; padding: 0.95rem 0; }
    .row strong { display: block; }
    .row p { margin: 0.15rem 0; color: #5c534b; }
    time { color: #6d645c; white-space: nowrap; }
    .empty { color: #6d645c; }
  </style>
</head>
<body>
  <main>
    <h1>Hamana Homes Visitor Logs</h1>
    ${rows || '<p class="empty">No visits yet.</p>'}
  </main>
</body>
</html>`;
  return new Response(body, { headers: { "content-type": "text/html; charset=utf-8" } });
}

function formatStay(seconds: number) {
  if (seconds < 60) return `Stayed ${seconds} sec`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `Stayed ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `Stayed ${hours} hr ${rest} min` : `Stayed ${hours} hr`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const marks: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return marks[char];
  });
}

async function readReply(request: Request): Promise<Reply | null> {
  let body: Partial<Reply>;
  try {
    body = (await request.json()) as Partial<Reply>;
  } catch {
    return null;
  }
  const guestId = clean(body.guestId, 80);
  const name = clean(body.name, 120);
  const blockLot = clean(body.blockLot, 80);
  const coming = body.coming === "yes" || body.coming === "no" ? body.coming : "";
  const guests = clean(body.guests, 4);
  const potluck = clean(body.potluck, 500);
  const suggestions = clean(body.suggestions, 500);
  const createdAt = clean(body.createdAt, 40);
  const updatedAt = clean(body.updatedAt, 40);
  if (!/^[0-9a-f-]{36}$/i.test(guestId) || !name || !blockLot || !coming) return null;
  if (guests && (!/^\d+$/.test(guests) || Number(guests) < 1 || Number(guests) > 30)) return null;
  return {
    guestId,
    name,
    blockLot,
    coming,
    guests,
    potluck,
    suggestions,
    createdAt: createdAt || new Date().toISOString(),
    updatedAt: updatedAt || new Date().toISOString(),
  };
}

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

async function upsertSheet(env: Env, reply: Reply) {
  const token = await googleToken(env.GOOGLE_CLIENT_EMAIL!, env.GOOGLE_PRIVATE_KEY!);
  const tab = env.SHEET_TAB || "RSVPs";
  const range = encodeURIComponent(`${tab}!A:A`);
  const listed = await sheetsFetch(token, env.GOOGLE_SHEET_ID!, `${range}`);
  const rows = (listed.values as string[][] | undefined) ?? [];
  if (!rows.length) {
    await sheetsFetch(token, env.GOOGLE_SHEET_ID!, `${encodeURIComponent(`${tab}!A1:I1`)}?valueInputOption=RAW`, {
      method: "PUT",
      body: JSON.stringify({ values: [COLUMNS] }),
    });
  }
  const values = [[
    reply.guestId,
    reply.name,
    reply.blockLot,
    reply.coming,
    reply.guests,
    reply.potluck,
    reply.suggestions,
    reply.createdAt,
    reply.updatedAt,
  ]];
  const existing = rows.findIndex((row) => row[0] === reply.guestId);
  if (existing >= 0) {
    const rowNumber = existing + 1;
    await sheetsFetch(
      token,
      env.GOOGLE_SHEET_ID!,
      `${encodeURIComponent(`${tab}!A${rowNumber}:I${rowNumber}`)}?valueInputOption=RAW`,
      { method: "PUT", body: JSON.stringify({ values }) },
    );
    return;
  }
  await sheetsFetch(
    token,
    env.GOOGLE_SHEET_ID!,
    `${encodeURIComponent(`${tab}!A:I`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { method: "POST", body: JSON.stringify({ values }) },
  );
}

async function sheetsFetch(token: string, sheetId: string, path: string, init?: RequestInit) {
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
  });
  if (!response.ok) throw new Error("sheet");
  return response.json() as Promise<{ values?: string[][] }>;
}

async function googleToken(email: string, privateKeyPem: string) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({
      iss: email,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const unsigned = `${header}.${claim}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToBytes(privateKeyPem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );
  const assertion = `${unsigned}.${b64url(signature)}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const token = (await response.json()) as { access_token?: string };
  if (!response.ok || !token.access_token) throw new Error("google");
  return token.access_token;
}

function pemToBytes(pem: string) {
  const body = pem.replace(/\\n/g, "\n").replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function b64url(value: string | ArrayBuffer) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value);
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function cors(response: Response) {
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", "*");
  headers.set("access-control-allow-methods", "POST, OPTIONS");
  headers.set("access-control-allow-headers", "content-type");
  return new Response(response.body, { status: response.status, headers });
}
