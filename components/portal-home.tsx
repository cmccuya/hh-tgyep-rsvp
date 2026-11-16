"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { event } from "@/lib/event";
import { readReply } from "@/lib/reply";
import { readHousehold, type Household } from "@/components/portal-gate";

type Room = "home" | "notices" | "events" | "household" | "documents";

const notices = [
  {
    tag: "Club house",
    title: "Thanksgiving & year-end party",
    when: "Dec 19",
    body: "Saturday, December 19 at 6:00 PM in the club house. One potluck dish and one gift per household.",
  },
  {
    tag: "Village",
    title: "Games for grownups and kids",
    when: "This month",
    body: "Prizes are planned for both. If you have a theme or a game in mind, add it on your party reply.",
  },
  {
    tag: "Gate",
    title: "Tell the guard your lot",
    when: "Standing",
    body: "Visitors for the club house should give the household’s block and lot. Yours is on your plaque.",
  },
];

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

  useEffect(() => {
    const saved = readHousehold();
    if (!saved) {
      router.replace("/login");
      return;
    }
    setHousehold(saved);
    setReply(readReply());
  }, [router]);

  function leave() {
    sessionStorage.removeItem("hamana-portal");
    router.replace("/login");
  }

  if (!household) return <main className="portal waiting">Opening your gate…</main>;

  const first = household.name.split(" ")[0];

  return (
    <main className="portal home">
      <aside className="lane">
        <p className="lane-brand">Hamana Homes</p>
        <nav>
          {rooms.map((item) => (
            <button key={item.id} type="button" className={room === item.id ? "on" : ""} onClick={() => setRoom(item.id)}>
              {item.label}
              {item.id === "notices" ? <em>3</em> : null}
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
                  <li key={note.title}>
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
                <PartyCard replyComing={reply?.coming} />
              </div>
            ) : null}
          </div>
        ) : null}

        {room === "events" ? (
          <div className="hearth-grid single">
            <PartyCard replyComing={reply?.coming} large />
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

        {room === "documents" ? (
          <article className="letter">
            <p className="eyebrow">Village papers</p>
            <h1>What the club house is asking.</h1>
            <ul className="notes-list">
              <li>
                <span>Gathering</span>
                <strong>{event.title}</strong>
                <p>{event.welcome}</p>
              </li>
              <li>
                <span>Table</span>
                <strong>{event.foodLabel}</strong>
                <p>{event.food}</p>
              </li>
              <li>
                <span>Exchange</span>
                <strong>{event.giftLabel}</strong>
                <p>{event.gift}</p>
              </li>
            </ul>
          </article>
        ) : null}
      </section>
    </main>
  );
}

function PartyCard({ replyComing, large = false }: { replyComing?: "yes" | "no"; large?: boolean }) {
  return (
    <article className={large ? "ticket large" : "ticket"}>
      <p className="ticket-date">
        <b>Dec</b>
        19
      </p>
      <div>
        <p className="eyebrow">Club house</p>
        <h2>{event.title}</h2>
        <p>6:00 PM · Hamana Homes Club House</p>
        <p className="ticket-state">
          {replyComing === "yes" ? "This phone already said yes." : replyComing === "no" ? "This phone already declined." : "Your reply is still open."}
        </p>
        <Link href="/#rsvp">Open the invitation</Link>
      </div>
    </article>
  );
}
