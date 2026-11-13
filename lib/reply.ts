export const STORAGE_KEY = "hamana-homes-rsvp";

export type Coming = "yes" | "no";

export type Reply = {
  guestId: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  blockLot: string;
  coming: Coming;
  guests: string;
  potluck: string;
  suggestions: string;
};

function isComing(value: unknown): value is Coming {
  return value === "yes" || value === "no";
}

export function readReply(): Reply | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Reply>;
    if (!parsed?.name || !isComing(parsed.coming)) return null;
    const now = new Date().toISOString();
    const reply: Reply = {
      guestId: parsed.guestId || crypto.randomUUID(),
      createdAt: parsed.createdAt || now,
      updatedAt: parsed.updatedAt || now,
      name: parsed.name,
      blockLot: parsed.blockLot || "",
      coming: parsed.coming,
      guests: parsed.guests || "",
      potluck: parsed.potluck || "",
      suggestions: parsed.suggestions || "",
    };
    if (!parsed.guestId) localStorage.setItem(STORAGE_KEY, JSON.stringify(reply));
    return reply;
  } catch {
    return null;
  }
}

export function rememberReply(reply: Reply) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reply));
}

export async function shareReply(reply: Reply): Promise<Reply> {
  rememberReply(reply);
  const url = process.env.NEXT_PUBLIC_RSVP_URL;
  if (!url) return reply;
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(reply),
  });
  if (!response.ok) throw new Error("The shared list did not accept this reply.");
  const body = (await response.json()) as { guestId?: string; createdAt?: string };
  const saved = {
    ...reply,
    guestId: body.guestId || reply.guestId,
    createdAt: body.createdAt || reply.createdAt,
  };
  rememberReply(saved);
  return saved;
}
