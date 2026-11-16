"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { event } from "@/lib/event";
import { readReply } from "@/lib/reply";
import { authHeader, portalApi, readHousehold, type Household } from "@/components/portal-gate";
import { Desk, type Post } from "@/components/portal-desk";

type Room = "home" | "notices" | "events" | "household" | "documents" | "desk" | "residents";

type Resident = {
  email: string;
  name: string;
  blockLot: string;
  status: "pending" | "approved";
  role: "admin" | "resident";
};

const rooms: { id: Room; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "notices", label: "Notices" },
  { id: "events", label: "Events" },
  { id: "household", label: "Household" },
  { id: "documents", label: "Papers" },
];

function hello() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function PortalHome() {
  const router = useRouter();
  const [household, setHousehold] = useState<Household | null>(null);
  const [room, setRoom] = useState<Room>("home");
  const [reply, setReply] = useState<ReturnType<typeof readReply>>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);

  useEffect(() => {
    const saved = readHousehold();
    const base = process.env.NEXT_PUBLIC_RSVP_URL;
    if (!saved || !base) {
      router.replace("/login");
      return;
    }
    const me = new URL("/auth/me", base).href;
    const board = new URL("/board", base).href;
    fetch(me, { headers: authHeader() })
      .then(async (response) => {
        if (!response.ok) throw new Error("signed out");
        const account = (await response.json()) as Household;
        setHousehold(account);
        setReply(readReply());
        const notes = await fetch(board, { headers: authHeader() });
        if (!notes.ok) throw new Error("signed out");
        const body = (await notes.json()) as { posts?: Post[] };
        setPosts(body.posts || []);
        if (account.role === "admin") {
          const people = await fetch(new URL("/admin/accounts", base).href, { headers: authHeader() });
          if (people.ok) {
            const roster = (await people.json()) as { accounts?: Resident[] };
            setResidents(roster.accounts || []);
          }
        }
      })
      .catch(() => {
        sessionStorage.removeItem("hamana-portal");
        sessionStorage.removeItem("hamana-portal-token");
        router.replace("/login");
      });
  }, [router]);

  async function decide(email: string, action: "approve" | "admin") {
    const url = portalApi("/admin/accounts");
    if (!url) return;
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeader() },
      body: JSON.stringify({ email, action }),
    });
    if (!response.ok) return;
    const body = (await response.json()) as { account?: Resident };
    const saved = body.account;
    if (!saved) return;
    setResidents((current) => current.map((person) => (person.email === email ? saved : person)));
  }

  function leave() {
    const base = process.env.NEXT_PUBLIC_RSVP_URL;
    if (base) {
      fetch(new URL("/auth/logout", base).href, { method: "POST", headers: authHeader() }).catch(() => undefined);
    }
    sessionStorage.removeItem("hamana-portal");
    sessionStorage.removeItem("hamana-portal-token");
    router.replace("/login");
  }

  if (!household) return <main className="portal waiting">Opening your gate…</main>;

  const first = household.name.split(" ")[0];
  const lane =
    household.role === "admin"
      ? [...rooms, { id: "desk" as Room, label: "Desk" }, { id: "residents" as Room, label: "Residents" }]
      : rooms;
  const notices = posts.filter((post) => post.kind === "notice");
  const events = posts.filter((post) => post.kind === "event");
  const papers = posts.filter((post) => post.kind === "paper");
  const party = events.find((post) => post.id === "event-party") || events[0];
  const waiting = residents.filter((person) => person.status !== "approved").length;

  return (
    <main className="portal home">
      <aside className="lane">
        <p className="lane-brand">Hamana Homes</p>
        <nav>
          {lane.map((item) => (
            <button key={item.id} type="button" className={room === item.id ? "on" : ""} onClick={() => setRoom(item.id)}>
              {item.label}
              {item.id === "notices" && notices.length ? <em>{notices.length}</em> : null}
              {item.id === "residents" && waiting ? <em>{waiting}</em> : null}
            </button>
          ))}
        </nav>
        <button type="button" className="leave" onClick={leave}>
          Step out
        </button>
      </aside>

      <section className="hearth">
        <header className="hearth-top">
          <p>Sto. Rosario, Magalang</p>
          <div className="who">
            <span>{initials(household.name)}</span>
            <strong>{household.name}</strong>
          </div>
        </header>

        {room === "home" || room === "notices" ? (
          <div className="hearth-grid">
            <article className="letter">
              <p className="eyebrow">{room === "notices" ? "Notice board" : hello()}</p>
              <h1>{room === "notices" ? "Pinned for the village" : `${first}, the house is awake.`}</h1>
              <ul className="notes-list">
                {notices.map((note) => (
                  <li key={note.id}>
                    <span>{note.tag}</span>
                    <time>{note.when}</time>
                    <strong>{note.title}</strong>
                    <p>{note.body}</p>
                  </li>
                ))}
              </ul>
            </article>
            {room === "home" ? (
              <div className="side-stack">
                <article className="plaque">
                  <p className="eyebrow">Your household</p>
                  <h2>{household.name}</h2>
                  <p>Block and lot {household.blockLot}</p>
                  <p>Hamana Homes, Sto. Rosario</p>
                </article>
                <PartyCard post={party} replyComing={reply?.coming} />
              </div>
            ) : null}
          </div>
        ) : null}

        {room === "events" ? (
          <div className="hearth-grid single">
            {events.length ? (
              events.map((post) => <PartyCard key={post.id} post={post} replyComing={post.id === "event-party" ? reply?.coming : undefined} large />)
            ) : (
              <article className="letter">
                <p className="eyebrow">Events</p>
                <h1>Nothing is on the calendar.</h1>
              </article>
            )}
          </div>
        ) : null}

        {room === "household" ? (
          <article className="letter">
            <p className="eyebrow">Household plaque</p>
            <h1>{household.name}</h1>
            <dl className="facts">
              <div>
                <dt>Subdivision</dt>
                <dd>Hamana Homes</dd>
              </div>
              <div>
                <dt>Block and lot</dt>
                <dd>{household.blockLot}</dd>
              </div>
              <div>
                <dt>Place</dt>
                <dd>Sto. Rosario, Magalang, Pampanga</dd>
              </div>
              <div>
                <dt>Party reply</dt>
                <dd>{reply ? (reply.coming === "yes" ? `Coming${reply.guests ? `, ${reply.guests} guests` : ""}` : "Regretfully declines") : "Not sent from this phone yet"}</dd>
              </div>
            </dl>
          </article>
        ) : null}

        {room === "residents" ? (
          <article className="letter">
            <p className="eyebrow">Admin</p>
            <h1>Who may come in.</h1>
            {residents.length ? (
              <ul className="roster">
                {[...residents].sort((a, b) => Number(a.status === "approved") - Number(b.status === "approved")).map((person) => (
                  <li key={person.email}>
                    <div>
                      <strong>
                        <Link href={`/household/?email=${encodeURIComponent(person.email)}`}>{person.name}</Link>
                      </strong>
                      <p>
                        {person.email} · {person.blockLot}
                      </p>
                    </div>
                    <Link className="details" href={`/household/?email=${encodeURIComponent(person.email)}`}>
                      Details
                    </Link>
                    {person.status !== "approved" ? (
                      <button type="button" onClick={() => decide(person.email, "approve")}>
                        Approve
                      </button>
                    ) : person.role === "admin" ? (
                      <span>{person.email === household.email ? "You" : "Admin"}</span>
                    ) : (
                      <button type="button" onClick={() => decide(person.email, "admin")}>
                        Make admin
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No one is waiting at the gate.</p>
            )}
          </article>
        ) : null}

        {room === "desk" ? <Desk posts={posts} onChange={setPosts} /> : null}

        {room === "documents" ? (
          <article className="letter">
            <p className="eyebrow">Village papers</p>
            <h1>What the club house is asking.</h1>
            {papers.length ? (
              <ul className="notes-list">
                {papers.map((post) => (
                  <li key={post.id}>
                    <span>{post.tag}</span>
                    {post.when ? <time>{post.when}</time> : null}
                    <strong>{post.title}</strong>
                    <p>{post.body}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Nothing is posted here yet.</p>
            )}
          </article>
        ) : null}
      </section>
    </main>
  );
}

function PartyCard({ post, replyComing, large = false }: { post?: Post; replyComing?: "yes" | "no"; large?: boolean }) {
  const when = post?.when || "Dec 19";
  const [head, ...rest] = when.split(" ");
  const party = !post || post.id === "event-party";
  return (
    <article className={large ? "ticket large" : "ticket"}>
      <p className="ticket-date">
        <b>{head || "Dec"}</b>
        {rest.join(" ") || "19"}
      </p>
      <div>
        <p className="eyebrow">{post?.tag || "Club house"}</p>
        <h2>{post?.title || event.title}</h2>
        <p>{post?.body || "6:00 PM · Hamana Homes Club House"}</p>
        {party ? (
          <p className="ticket-state">
            {replyComing === "yes" ? "This phone already said yes." : replyComing === "no" ? "This phone already declined." : "Your reply is still open."}
          </p>
        ) : null}
        {party ? <Link href="/#rsvp">Open the invitation</Link> : null}
      </div>
    </article>
  );
}
