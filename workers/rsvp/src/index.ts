interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  run(): Promise<unknown>;
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
