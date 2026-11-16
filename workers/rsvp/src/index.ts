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
    if (request.method === "POST" && url.pathname === "/sign-in") {
      return cors(await recordSignIn(request, env));
    }
    if (request.method === "POST" && url.pathname === "/auth/login") {
      return cors(await login(request, env));
    }
    if (request.method === "GET" && url.pathname === "/auth/me") {
      return cors(await currentAccount(request, env));
    }
    if (request.method === "POST" && url.pathname === "/auth/logout") {
      return cors(await logout(request, env));
    }
    if (request.method === "GET" && url.pathname === "/notices") {
      return cors(await residentNotices(request, env));
    }
    if (request.method === "GET" && url.pathname === "/sign-ins") {
      return signInLog(request, env, url);
    }
    if (request.method !== "POST" || url.pathname !== "/rsvp") {
      return cors(json({ error: "Not found" }, 404));
    }
    const reply = await readReply(request);
    if (!reply) return cors(json({ error: "Check the reply and try again." }, 400));

    const saved = await saveHousehold(env, reply);
    let sheet: "updated" | "unavailable" = "unavailable";
    try {
      if (env.GOOGLE_SHEET_ID && env.GOOGLE_CLIENT_EMAIL && env.GOOGLE_PRIVATE_KEY) {
        await upsertSheet(env, saved, reply.guestId);
        sheet = "updated";
      }
    } catch {
      sheet = "unavailable";
    }

    return cors(json({ ok: true, guestId: saved.guestId, createdAt: saved.createdAt, sheet }));
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
  const sessionId = report.sessionId || crypto.randomUUID();
  const found = await env.DB.prepare(
    "SELECT reported_seconds, pages FROM visit_sessions WHERE session_id = ?",
  )
    .bind(sessionId)
    .all<{ reported_seconds: number; pages: string }>();
  const previous = found.results[0]?.reported_seconds ?? 0;
  const seconds = Math.max(previous, report.seconds);
  const pages = addPage(found.results[0]?.pages ?? "", report.page);
  await env.DB.prepare(
    `INSERT INTO visit_sessions (session_id, ip, device, browser, place, reported_seconds, pages, last_seen, started_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(session_id) DO UPDATE SET
       reported_seconds = excluded.reported_seconds,
       pages = excluded.pages,
       device = excluded.device,
       browser = excluded.browser,
       place = excluded.place,
       last_seen = excluded.last_seen`,
  )
    .bind(sessionId, ip, device, browser, place, seconds, pages, seen, seen)
    .run();
  return json({ ok: true });
}

async function readStay(request: Request) {
  try {
    const body = JSON.parse(await request.text()) as { sessionId?: unknown; seconds?: unknown; page?: unknown };
    const sessionId = typeof body.sessionId === "string" ? body.sessionId.slice(0, 80) : "";
    const seconds = Math.min(14400, Math.max(0, Math.round(Number(body.seconds) || 0)));
    const page = body.page === "Cover" || body.page === "Party" || body.page === "RSVP" ? body.page : "";
    if (!/^[0-9a-f-]{36}$/i.test(sessionId)) return { sessionId: "", seconds: 0, page };
    return { sessionId, seconds, page };
  } catch {
    return { sessionId: "", seconds: 0, page: "" };
  }
}

function addPage(existing: string, page: string) {
  const pages = existing.split(",").map((item) => item.trim()).filter(Boolean);
  if (page && !pages.includes(page)) pages.push(page);
  return pages.join(", ");
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

async function visitLog(_request: Request, env: Env, url: URL) {
  const key = url.searchParams.get("key") || "";
  if (!env.VISITS_KEY || key !== env.VISITS_KEY) return json({ error: "Not found" }, 404);
  const listed = await env.DB.prepare(
    "SELECT device, browser, place, ip, reported_seconds, pages, last_seen, started_at FROM visit_sessions ORDER BY last_seen DESC",
  ).all<{
    device: string;
    browser: string;
    place: string;
    ip: string;
    reported_seconds: number;
    pages: string;
    last_seen: string;
    started_at: string;
  }>();
  const selectedIp = url.searchParams.get("ip");
  if (selectedIp) {
    const stays = listed.results
      .filter((visit) => visit.ip === selectedIp)
      .sort((a, b) => (b.started_at || b.last_seen).localeCompare(a.started_at || a.last_seen));
    const title = stays[0] ? `${stays[0].device} · ${stays[0].browser}` : "Visitor";
    const rows = stays
      .map((visit, index) => {
        const when = formatWhen(visit.started_at || visit.last_seen);
        return `<article class="row">
          <div>
            <strong>Visit ${stays.length - index}</strong>
            <p>${escapeHtml(formatStay(visit.reported_seconds || 0))}</p>
            ${visit.pages ? `<p>Pages: ${escapeHtml(visit.pages)}</p>` : ""}
          </div>
          <time datetime="${escapeHtml(when.iso)}">${escapeHtml(when.date)}<br>${escapeHtml(when.time)}</time>
        </article>`;
      })
      .join("");
    return page(
      "Hamana Homes Visitor",
      `${logNav(key, "visits")}<p class="back"><a href="/visits?key=${encodeURIComponent(key)}">Back to visitor logs</a></p>
       <h1>${escapeHtml(title)}</h1>
       <p class="quiet">${escapeHtml(stays[0]?.place || "Unknown place")}</p>
       <p class="quiet">IP: ${escapeHtml(selectedIp)}</p>
       ${rows || '<p class="empty">No visits for this address.</p>'}`,
    );
  }

  const visitors = new Map<string, {
    device: string;
    browser: string;
    place: string;
    ip: string;
    visits: number;
    last_seen: string;
    started_at: string;
  }>();
  for (const visit of listed.results) {
    const current = visitors.get(visit.ip);
    if (!current) {
      visitors.set(visit.ip, {
        device: visit.device,
        browser: visit.browser,
        place: visit.place,
        ip: visit.ip,
        visits: 1,
        last_seen: visit.last_seen,
        started_at: visit.started_at || visit.last_seen,
      });
    } else {
      current.visits += 1;
    }
  }
  const rows = [...visitors.values()]
    .map((visit) => {
      const when = formatWhen(visit.started_at || visit.last_seen);
      const count = `${visit.visits} visit${visit.visits === 1 ? "" : "s"}`;
      const href = `/visits?key=${encodeURIComponent(key)}&ip=${encodeURIComponent(visit.ip)}`;
      return `<article class="row">
        <div>
          <strong>${escapeHtml(visit.device)} · ${escapeHtml(visit.browser)}</strong>
          <p>${escapeHtml(visit.place)}</p>
          <p>IP: ${escapeHtml(visit.ip)}</p>
          <p><a href="${href}">${escapeHtml(count)}</a></p>
        </div>
        <time datetime="${escapeHtml(when.iso)}">${escapeHtml(when.date)}<br>${escapeHtml(when.time)}</time>
      </article>`;
    })
    .join("");
  return page("Hamana Homes Visitor Logs", `${logNav(key, "visits")}<h1>Hamana Homes Visitor Logs</h1>${rows || '<p class="empty">No visits yet.</p>'}`);
}

async function recordSignIn(request: Request, env: Env) {
  let body: { name?: unknown; blockLot?: unknown };
  try {
    body = JSON.parse(await request.text()) as { name?: unknown; blockLot?: unknown };
  } catch {
    return json({ error: "Check the sign-in and try again." }, 400);
  }
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
  const blockLot = typeof body.blockLot === "string" ? body.blockLot.trim().slice(0, 80) : "";
  if (!name || !blockLot) return json({ error: "Add a name and a block and lot." }, 400);
  await saveSignIn(request, env, name, blockLot);
  return json({ ok: true });
}

async function login(request: Request, env: Env) {
  let body: { email?: unknown; password?: unknown };
  try {
    body = JSON.parse(await request.text()) as { email?: unknown; password?: unknown };
  } catch {
    return json({ error: "Check the email and password." }, 400);
  }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 160) : "";
  const password = typeof body.password === "string" ? body.password.slice(0, 200) : "";
  if (!email || !password) return json({ error: "Enter your email and password." }, 400);
  await ensureAccounts(env);
  const found = await env.DB.prepare(
    "SELECT email, name, block_lot, password_salt, password_hash FROM accounts WHERE email = ?",
  )
    .bind(email)
    .all<{ email: string; name: string; block_lot: string; password_salt: string; password_hash: string }>();
  const account = found.results[0];
  const hash = account ? await hashPassword(password, account.password_salt) : await hashPassword(password, "missing-account");
  if (!account || !safeEqual(hash, account.password_hash)) {
    return json({ error: "That email or password does not match an account." }, 401);
  }
  const token = [...crypto.getRandomValues(new Uint8Array(32))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const expires = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  await env.DB.prepare("INSERT INTO sessions (token_hash, email, expires_at) VALUES (?, ?, ?)").bind(await sha256(token), email, expires).run();
  await saveSignIn(request, env, account.name, account.block_lot);
  return json({ token, name: account.name, email: account.email, blockLot: account.block_lot });
}

async function currentAccount(request: Request, env: Env) {
  const account = await accountFromRequest(request, env);
  if (!account) return json({ error: "Sign in again." }, 401);
  return json(account);
}

async function logout(request: Request, env: Env) {
  const token = bearer(request);
  if (token) {
    await ensureAccounts(env);
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256(token)).run();
  }
  return json({ ok: true });
}

async function residentNotices(request: Request, env: Env) {
  const account = await accountFromRequest(request, env);
  if (!account) return json({ error: "Sign in again." }, 401);
  return json({
    notices: [
      {
        tag: "Admin office",
        title: "Admin office hours",
        when: "Nov 10",
        body: "The Residential & Facilities Management Office is open Monday to Friday, 8:00 AM to 5:00 PM, with lunch from 12:00 NN to 1:00 PM. Saturday is 8:00 AM to 12:00 NN. Sunday and holidays are closed.",
      },
      {
        tag: "Water",
        title: "Scheduled water interruption",
        when: "Nov 5",
        body: "On November 5, 2026, from 9:00 AM to 5:00 PM, water service was scheduled to pause for the water meter stubout relocation. Affected areas: Block 25 (Lots 1–46), Block 26, Block 32, Block 33, and Block 34. Water may look discolored when it returns. See Circular No. 2026-075.",
      },
      {
        tag: "Holiday",
        title: "Admin office closed for Undas",
        when: "Nov 2",
        body: "The Administration Office was closed on November 2, 2026 for All Souls’ Day, an additional special non-working day under Proclamation No. 1006. Regular office operations resumed on November 3. Urgent concerns go through the Security Office.",
      },
      {
        tag: "Invitation",
        title: "Paws, Pose & Win",
        when: "Oct 24",
        body: "The Magalang Grand Open House invited residents on October 24, 2026, 8:00 AM to 5:00 PM, at the retail area. Pet owners could join the costume activity, a complimentary treat, and the Facebook photo contest through November 7. The office number is 0953-802-7303.",
      },
      {
        tag: "Pool",
        title: "Swimming pool temporarily closed",
        when: "Oct 2",
        body: "The HHM swimming pool was closed until further notice after heavy rain, for water quality checks, cleaning, and maintenance. Questions go to the Residential Management Office at 0953-802-7303.",
      },
    ],
  });
}

async function accountFromRequest(request: Request, env: Env) {
  const token = bearer(request);
  if (!token) return null;
  await ensureAccounts(env);
  const found = await env.DB.prepare(
    `SELECT accounts.email, accounts.name, accounts.block_lot
     FROM sessions JOIN accounts ON accounts.email = sessions.email
     WHERE sessions.token_hash = ? AND sessions.expires_at > ?`,
  )
    .bind(await sha256(token), new Date().toISOString())
    .all<{ email: string; name: string; block_lot: string }>();
  const account = found.results[0];
  if (!account) return null;
  return { email: account.email, name: account.name, blockLot: account.block_lot };
}

async function ensureAccounts(env: Env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS accounts (
      email TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      block_lot TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,
  ).run();
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      expires_at TEXT NOT NULL
    )`,
  ).run();
}

async function hashPassword(password: string, salt: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: new TextEncoder().encode(salt), iterations: 100000, hash: "SHA-256" },
    key,
    256,
  );
  return [...new Uint8Array(bits)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function bearer(request: Request) {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+([a-f0-9]+)$/i);
  return match?.[1] || "";
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return diff === 0;
}

async function saveSignIn(request: Request, env: Env, name: string, blockLot: string) {
  const ip = request.headers.get("cf-connecting-ip") || "Unknown";
  const { device, browser } = describeAgent(request.headers.get("user-agent") || "");
  const cf = (request as Request & { cf?: { city?: string; region?: string; country?: string } }).cf;
  const place = [cf?.city, cf?.region || cf?.country].filter(Boolean).join(", ") || "Unknown";
  await ensureSignIns(env);
  await env.DB.prepare(
    `INSERT INTO sign_ins (name, block_lot, ip, device, browser, place, signed_in_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(name, blockLot, ip, device, browser, place, new Date().toISOString())
    .run();
}

async function ensureSignIns(env: Env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS sign_ins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      block_lot TEXT NOT NULL,
      ip TEXT NOT NULL,
      device TEXT NOT NULL,
      browser TEXT NOT NULL,
      place TEXT NOT NULL,
      signed_in_at TEXT NOT NULL
    )`,
  ).run();
}

async function signInLog(_request: Request, env: Env, url: URL) {
  const key = url.searchParams.get("key") || "";
  if (!env.VISITS_KEY || key !== env.VISITS_KEY) return json({ error: "Not found" }, 404);
  await ensureSignIns(env);
  const listed = await env.DB.prepare(
    "SELECT name, block_lot, ip, device, browser, place, signed_in_at FROM sign_ins ORDER BY signed_in_at DESC",
  ).all<{
    name: string;
    block_lot: string;
    ip: string;
    device: string;
    browser: string;
    place: string;
    signed_in_at: string;
  }>();
  const selected = url.searchParams.get("household");
  if (selected) {
    const stays = listed.results.filter((signIn) => blockKey(signIn.block_lot) === selected);
    const title = stays[0] ? stays[0].name : "Household";
    const rows = stays
      .map((signIn, index) => {
        const when = formatWhen(signIn.signed_in_at);
        return `<article class="row">
          <div>
            <strong>Sign-in ${stays.length - index}</strong>
            <p>${escapeHtml(signIn.name)} · ${escapeHtml(signIn.block_lot)}</p>
            <p>${escapeHtml(signIn.device)} · ${escapeHtml(signIn.browser)}</p>
            <p>${escapeHtml(signIn.place)}</p>
          </div>
          <time datetime="${escapeHtml(when.iso)}">${escapeHtml(when.date)}<br>${escapeHtml(when.time)}</time>
        </article>`;
      })
      .join("");
    return page(
      "Hamana Homes Sign-in",
      `${logNav(key, "sign-ins")}
       <p class="back"><a href="/sign-ins?key=${encodeURIComponent(key)}">Back to sign-ins</a></p>
       <h1>${escapeHtml(title)}</h1>
       <p class="quiet">${escapeHtml(stays[0]?.block_lot || "Unknown lot")}</p>
       ${rows || '<p class="empty">No sign-ins for this household.</p>'}`,
    );
  }

  const households = new Map<string, { name: string; blockLot: string; count: number; signedInAt: string }>();
  for (const signIn of listed.results) {
    const lot = blockKey(signIn.block_lot);
    const current = households.get(lot);
    if (!current) {
      households.set(lot, { name: signIn.name, blockLot: signIn.block_lot, count: 1, signedInAt: signIn.signed_in_at });
    } else {
      current.count += 1;
    }
  }
  const rows = [...households.entries()]
    .map(([lot, household]) => {
      const when = formatWhen(household.signedInAt);
      const count = `${household.count} sign-in${household.count === 1 ? "" : "s"}`;
      const href = `/sign-ins?key=${encodeURIComponent(key)}&household=${encodeURIComponent(lot)}`;
      return `<article class="row">
        <div>
          <strong>${escapeHtml(household.name)}</strong>
          <p>${escapeHtml(household.blockLot)}</p>
          <p><a href="${href}">${escapeHtml(count)}</a></p>
        </div>
        <time datetime="${escapeHtml(when.iso)}">${escapeHtml(when.date)}<br>${escapeHtml(when.time)}</time>
      </article>`;
    })
    .join("");
  return page(
    "Hamana Homes Sign-ins",
    `${logNav(key, "sign-ins")}<h1>Hamana Homes Sign-ins</h1>${rows || '<p class="empty">No one has signed in yet.</p>'}`,
  );
}

function logNav(key: string, current: "visits" | "sign-ins") {
  const query = `key=${encodeURIComponent(key)}`;
  const visits = current === "visits" ? "Invitation visits" : `<a href="/visits?${query}">Invitation visits</a>`;
  const signIns = current === "sign-ins" ? "Sign-ins" : `<a href="/sign-ins?${query}">Sign-ins</a>`;
  return `<p class="back">${visits} · ${signIns}</p>`;
}

function formatWhen(value: string) {
  const date = new Date(value);
  const zone = "Asia/Manila";
  return {
    date: date.toLocaleDateString("en-US", { timeZone: zone, month: "short", day: "numeric", year: "numeric" }),
    time: date.toLocaleTimeString("en-US", { timeZone: zone, hour: "numeric", minute: "2-digit" }),
    iso: date.toISOString(),
  };
}

function page(title: string, body: string) {
  return new Response(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${escapeHtml(title)}</title>
  <style>
    body { margin: 0; background: #f6f4ef; color: #241c17; font: 16px/1.4 Arial, sans-serif; }
    main { max-width: 720px; margin: 2rem auto; background: #fff; border: 1px solid #e6e0d6; border-radius: 16px; padding: 1.25rem 1.4rem 0.4rem; }
    h1 { margin: 0 0 1rem; font-size: 1.35rem; }
    .row { display: flex; justify-content: space-between; gap: 1rem; border-top: 1px solid #eee; padding: 0.95rem 0; }
    .row strong { display: block; }
    .row p, .quiet { margin: 0.15rem 0; color: #5c534b; }
    a { color: #742433; }
    .back { margin: 0 0 0.8rem; }
    time { color: #6d645c; white-space: nowrap; text-align: right; }
    .empty { color: #6d645c; }
  </style>
</head>
<body>
  <main>${body}</main>
</body>
</html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );
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

type StoredRsvp = {
  guest_id: string;
  name: string;
  block_lot: string;
  coming: string;
  guests: string;
  potluck: string;
  suggestions: string;
  created_at: string;
  updated_at: string;
};

function blockKey(blockLot: string) {
  const text = blockLot.toLowerCase();
  const labeled = text.match(/(?:block|blk|b)\s*[-.]?\s*(\d+)\s*[-/,]?\s*(?:lot|lt|l)\s*[-.]?\s*(\d+)([a-z])?/);
  if (labeled) return `${labeled[1]}|${labeled[2]}${labeled[3] || ""}`;
  const pair = text.match(/(\d+)\s*[-/,\s]\s*(\d+)([a-z])?/);
  if (pair) return `${pair[1]}|${pair[2]}${pair[3] || ""}`;
  const numbers = text.match(/\d+/g) ?? [];
  if (numbers.length >= 2) return `${numbers[0]}|${numbers[1]}`;
  return text.replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

async function saveHousehold(env: Env, reply: Reply): Promise<Reply> {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS rsvp_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guest_id TEXT NOT NULL,
      name TEXT NOT NULL,
      block_lot TEXT NOT NULL,
      coming TEXT NOT NULL,
      guests TEXT NOT NULL DEFAULT '',
      potluck TEXT NOT NULL DEFAULT '',
      suggestions TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      replaced_at TEXT NOT NULL
    )`,
  ).run();
  const listed = await env.DB.prepare(
    "SELECT guest_id, name, block_lot, coming, guests, potluck, suggestions, created_at, updated_at FROM rsvps",
  ).all<StoredRsvp>();
  const key = blockKey(reply.blockLot);
  const sameLot = listed.results
    .filter((row) => blockKey(row.block_lot) === key)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const sameGuest = listed.results.find((row) => row.guest_id === reply.guestId);
  const match = sameLot[0] || sameGuest;
  if (!match) {
    await env.DB.prepare(
      `INSERT INTO rsvps (guest_id, name, block_lot, coming, guests, potluck, suggestions, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    return reply;
  }
  const extras = listed.results.filter(
    (row) => row.guest_id !== match.guest_id && (row.guest_id === reply.guestId || blockKey(row.block_lot) === key),
  );
  for (const extra of extras) {
    if (extra.guest_id !== reply.guestId) await rememberHistory(env, extra, reply.updatedAt);
    await env.DB.prepare("DELETE FROM rsvps WHERE guest_id = ?").bind(extra.guest_id).run();
  }
  if (match.guest_id !== reply.guestId) await rememberHistory(env, match, reply.updatedAt);
  await env.DB.prepare(
    `UPDATE rsvps
     SET name = ?, block_lot = ?, coming = ?, guests = ?, potluck = ?, suggestions = ?, updated_at = ?
     WHERE guest_id = ?`,
  )
    .bind(
      reply.name,
      reply.blockLot,
      reply.coming,
      reply.guests,
      reply.potluck,
      reply.suggestions,
      reply.updatedAt,
      match.guest_id,
    )
    .run();
  return { ...reply, guestId: match.guest_id, createdAt: match.created_at || reply.createdAt };
}

async function rememberHistory(env: Env, row: StoredRsvp, replacedAt: string) {
  await env.DB.prepare(
    `INSERT INTO rsvp_history (guest_id, name, block_lot, coming, guests, potluck, suggestions, created_at, updated_at, replaced_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      row.guest_id,
      row.name,
      row.block_lot,
      row.coming,
      row.guests,
      row.potluck,
      row.suggestions,
      row.created_at,
      row.updated_at,
      replacedAt,
    )
    .run();
}

async function upsertSheet(env: Env, reply: Reply, incomingGuestId = reply.guestId) {
  const token = await googleToken(env.GOOGLE_CLIENT_EMAIL!, env.GOOGLE_PRIVATE_KEY!);
  const tab = env.SHEET_TAB || "RSVPs";
  const spreadsheetId = env.GOOGLE_SHEET_ID!;
  await ensureHeader(token, spreadsheetId, tab, COLUMNS);
  const listed = await sheetsFetch(token, spreadsheetId, encodeURIComponent(`${tab}!A:I`));
  const rows = (listed.values as string[][] | undefined) ?? [];
  const key = blockKey(reply.blockLot);
  const matches = rows
    .map((row, index) => ({ row, index }))
    .filter((item) => item.index > 0 && (item.row[0] === reply.guestId || blockKey(item.row[2] || "") === key));
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
  if (!matches.length) {
    await sheetsFetch(
      token,
      spreadsheetId,
      `${encodeURIComponent(`${tab}!A:I`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      { method: "POST", body: JSON.stringify({ values }) },
    );
    return;
  }
  const canonical = matches.find((item) => item.row[0] === reply.guestId) || matches[0];
  const extras = matches.filter((item) => item.index !== canonical.index);
  for (const extra of extras) {
    if (extra.row[0] !== incomingGuestId) await archiveSheetRow(token, spreadsheetId, extra.row, reply.updatedAt);
  }
  if (canonical.row[0] && canonical.row[0] !== incomingGuestId) {
    await archiveSheetRow(token, spreadsheetId, canonical.row, reply.updatedAt);
  }
  if (extras.length) {
    await deleteSheetRows(
      token,
      spreadsheetId,
      await sheetIdFor(token, spreadsheetId, tab),
      extras.map((item) => item.index),
    );
  }
  const removedAbove = extras.filter((item) => item.index < canonical.index).length;
  const rowNumber = canonical.index + 1 - removedAbove;
  await sheetsFetch(
    token,
    spreadsheetId,
    `${encodeURIComponent(`${tab}!A${rowNumber}:I${rowNumber}`)}?valueInputOption=RAW`,
    { method: "PUT", body: JSON.stringify({ values }) },
  );
}

async function archiveSheetRow(token: string, spreadsheetId: string, row: string[], replacedAt: string) {
  const title = "Earlier replies";
  await ensureTab(token, spreadsheetId, title);
  await ensureHeader(token, spreadsheetId, title, [...COLUMNS, "replaced_at"]);
  await sheetsFetch(
    token,
    spreadsheetId,
    `${encodeURIComponent(`${title}!A:J`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      body: JSON.stringify({
        values: [[row[0] || "", row[1] || "", row[2] || "", row[3] || "", row[4] || "", row[5] || "", row[6] || "", row[7] || "", row[8] || "", replacedAt]],
      }),
    },
  );
}

async function ensureHeader(token: string, spreadsheetId: string, title: string, columns: string[]) {
  const listed = await sheetsFetch(token, spreadsheetId, encodeURIComponent(`${title}!A1:J1`));
  const header = (listed.values as string[][] | undefined)?.[0];
  if (header && header[0] === columns[0]) return;
  const end = String.fromCharCode(64 + columns.length);
  await sheetsFetch(
    token,
    spreadsheetId,
    `${encodeURIComponent(`${title}!A1:${end}1`)}?valueInputOption=RAW`,
    { method: "PUT", body: JSON.stringify({ values: [columns] }) },
  );
}

async function sheetIdFor(token: string, spreadsheetId: string, title: string) {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  if (!response.ok) throw new Error("sheet");
  const data = (await response.json()) as { sheets?: { properties?: { title?: string; sheetId?: number } }[] };
  const found = (data.sheets || []).find((sheet) => sheet.properties?.title === title);
  if (found?.properties?.sheetId === undefined) throw new Error("sheet");
  return found.properties.sheetId;
}

async function deleteSheetRows(token: string, spreadsheetId: string, sheetId: number, indexes: number[]) {
  const sorted = [...indexes].sort((a, b) => b - a);
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      requests: sorted.map((index) => ({
        deleteDimension: {
          range: { sheetId, dimension: "ROWS", startIndex: index, endIndex: index + 1 },
        },
      })),
    }),
  });
  if (!response.ok) throw new Error("sheet");
}

async function ensureTab(token: string, spreadsheetId: string, title: string) {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  if (!response.ok) throw new Error("sheet");
  const data = (await response.json()) as { sheets?: { properties?: { title?: string } }[] };
  const titles = (data.sheets || []).map((sheet) => sheet.properties?.title);
  if (titles.includes(title)) return;
  const created = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title } } }] }),
  });
  if (!created.ok) throw new Error("sheet");
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
  headers.set("access-control-allow-methods", "GET, POST, OPTIONS");
    headers.set("access-control-allow-headers", "content-type, authorization");
  return new Response(response.body, { status: response.status, headers });
}
