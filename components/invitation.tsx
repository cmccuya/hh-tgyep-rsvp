"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { CarolFrame, useCarol } from "@/components/music";
import { RsvpForm } from "@/components/rsvp-form";
import { event } from "@/lib/event";

type View = "cover" | "party" | "rsvp";

function viewFromHash(): View {
  if (window.location.hash === "#rsvp") return "rsvp";
  if (window.location.hash === "#party") return "party";
  return "cover";
}

export function Invitation() {
  const [view, setView] = useState<View>("cover");
  const carol = useCarol();

  useEffect(() => {
    const apply = () => setView(viewFromHash());
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  function go(next: View) {
    window.location.hash = next === "cover" ? "" : `#${next}`;
    window.scrollTo(0, 0);
  }

  function openCard() {
    window.location.hash = "#party";
    window.scrollTo(0, 0);
    carol.play();
  }

  return (
    <div className="stage">
      <CarolFrame />
      {view !== "cover" ? (
        <button
          type="button"
          className="music"
          aria-pressed={carol.playing}
          onClick={() => (carol.playing ? carol.pause() : carol.play())}
        >
          <Bell />
          <span>
            <strong>{carol.playing ? "Pause" : "Play"}</strong>
            <small>
              {event.song}
              <br />
              {event.artist}
            </small>
          </span>
        </button>
      ) : null}

      {view === "cover" ? (
        <section className="cover">
          <Image className="cover-bg" src="/art/snow.jpg" alt="" fill priority sizes="100vw" />
          <div className="cover-inner">
            <Image className="garland" src="/art/garland.png" alt="" width={1000} height={558} priority />
            <p className="eyebrow light">You&apos;re invited</p>
            <h1>{event.host}</h1>
            <p className="cover-title">{event.title}</p>
            <button type="button" className="mailbox" onClick={openCard}>
              <Image src="/art/mailbox.png" alt="" width={900} height={900} priority />
              <span>Open the invitation</span>
            </button>
          </div>
        </section>
      ) : null}

      {view === "party" ? (
        <article className="sheet rise">
          <Image className="garland" src="/art/garland.png" alt="" width={1000} height={558} />

          <div className="frame frame-bow">
            <Image src="/art/bow.png" alt="" width={1000} height={1339} />
            <div className="frame-copy">
              <p className="eyebrow">{event.host}</p>
              <h1>{event.title}</h1>
              <p>{event.welcome}</p>
            </div>
          </div>

          <div className="plaque">
            <Image src="/art/plaque.png" alt="" width={1000} height={558} />
            <div className="plaque-copy">
              <p>{event.dateLabel}</p>
              <strong>{event.dateValue}</strong>
            </div>
          </div>
          <p className="note">{event.dateNote}</p>

          <section className="block">
            <h2>{event.placeLabel}</h2>
            <p className="place">{event.place}</p>
            <p className="quiet">{event.placeDetail}</p>
            <a className="btn btn-berry" href={event.mapUrl} target="_blank" rel="noopener noreferrer">
              Check location
            </a>
          </section>

          <Image className="ornament tree" src="/art/tree.png" alt="Watercolor Christmas tree with wrapped gifts" width={900} height={900} />

          <section className="block">
            <h2>{event.foodLabel}</h2>
            <p>{event.food}</p>
          </section>

          <section className="block">
            <h2>{event.giftLabel}</h2>
            <p>{event.gift}</p>
          </section>

          <Image
            className="ornament sleigh"
            src="/art/sleigh.png"
            alt="Watercolor of Santa in a sleigh pulled by a reindeer"
            width={900}
            height={900}
          />

          <section className="games">
            <Image src="/art/nutcracker.png" alt="Watercolor nutcracker" width={900} height={1205} />
            <div>
              <h2>{event.gamesLabel}</h2>
              <p>{event.games}</p>
            </div>
          </section>

          <div className="frame frame-scallop">
            <Image src="/art/scallop.png" alt="" width={1000} height={1339} />
            <div className="frame-copy">
              <h2>{event.inputLabel}</h2>
              <p>{event.input}</p>
            </div>
          </div>

          <div className="rsvp-cta">
            <Image src="/art/envelope.png" alt="" width={900} height={900} />
            <p className="script">{event.rsvp}</p>
            <button type="button" className="btn btn-berry" onClick={() => go("rsvp")}>
              Send your reply
            </button>
          </div>

          <footer>
            <p>
              {event.song} is performed by {event.artist} and plays from the official video.
            </p>
          </footer>
        </article>
      ) : null}

      {view === "rsvp" ? (
        <div className="rise">
          <RsvpForm onBack={() => go("party")} />
        </div>
      ) : null}
    </div>
  );
}

function Bell() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
      <path
        d="M12 3.5a.8.8 0 0 1 .8.7V5a6 6 0 0 1 4.7 5.8v2.2c0 .7.3 1.4.8 1.9l.6.5H5.1l.6-.5a2.6 2.6 0 0 0 .8-1.9v-2.2A6 6 0 0 1 11.2 5V4.2a.8.8 0 0 1 .8-.7Zm0 16.2a2.1 2.1 0 0 0 2-1.5H10a2.1 2.1 0 0 0 2 1.5Z"
        fill="currentColor"
      />
    </svg>
  );
}
