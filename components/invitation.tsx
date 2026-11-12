"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Countdown } from "@/components/countdown";
import { RsvpForm } from "@/components/rsvp-form";
import { Snow } from "@/components/snow";
import { Chime } from "@/lib/chime";
import { event } from "@/lib/event";

type View = "cover" | "party" | "rsvp";

function viewFromHash(): View {
  if (window.location.hash === "#rsvp") return "rsvp";
  if (window.location.hash === "#party") return "party";
  return "cover";
}

export function Invitation() {
  const [view, setView] = useState<View>("cover");
  const [musicOn, setMusicOn] = useState(false);
  const chime = useRef<Chime | null>(null);

  useEffect(() => {
    const apply = () => setView(viewFromHash());
    apply();
    window.addEventListener("hashchange", apply);
    return () => {
      window.removeEventListener("hashchange", apply);
      chime.current?.stop();
    };
  }, []);

  async function play() {
    if (!chime.current) chime.current = new Chime();
    await chime.current.start();
    setMusicOn(true);
  }

  function pause() {
    chime.current?.stop();
    setMusicOn(false);
  }

  async function openCard() {
    window.location.hash = "#party";
    window.scrollTo(0, 0);
    await play();
  }

  function go(next: View) {
    window.location.hash = next === "cover" ? "" : `#${next}`;
    window.scrollTo(0, 0);
  }

  return (
    <div className={view === "cover" ? "stage stage-night" : "stage"}>
      <Snow />
      {view !== "cover" ? (
        <button
          type="button"
          className="music"
          aria-pressed={musicOn}
          onClick={() => (musicOn ? pause() : play())}
        >
          <Bell />
          <span>{musicOn ? "Pause music" : "Play music"}</span>
        </button>
      ) : null}

      {view === "cover" ? (
        <section className="cover">
          <p className="eyebrow light">{event.kicker}</p>
          <h1>
            Christmas
            <em> Party</em>
          </h1>
          <button type="button" className="postcard" onClick={openCard}>
            <Image
              src="/art/tomte.jpg"
              alt="Watercolor of a white-bearded figure in a red cap carrying gifts through the snow, painted by Jenny Nyström"
              width={1100}
              height={1532}
              priority
            />
            <span>Open the card</span>
          </button>
          <p className="byline">{event.host}</p>
        </section>
      ) : null}

      {view === "party" ? (
        <article className="sheet rise">
          <figure className="hero">
            <Image
              src="/art/sleigh.jpg"
              alt="Watercolor of a horse-drawn sleigh crossing the snow toward a lit church, painted by Jenny Nyström"
              width={1200}
              height={1494}
              priority
            />
          </figure>

          <header className="intro">
            <p className="eyebrow">{event.merry}</p>
            <h1>
              Christmas
              <em> Party</em>
            </h1>
            <p className="hosted">
              Hosted by <strong>{event.host}</strong>
            </p>
            <p className="when">{event.dateLine}</p>
            <p className="quiet">{event.dateDetail}</p>
            <address>
              {event.street}
              <br />
              {event.city}
            </address>
            <a
              className="btn btn-berry"
              href={event.mapUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Check location
            </a>
          </header>

          <section className="plate">
            <Image
              src="/art/birds.jpg"
              alt="Watercolor of two children at a snowy fence, feeding birds, painted by Jenny Nyström"
              width={1100}
              height={1596}
            />
            <div>
              <h2>Attire</h2>
              <p>{event.attire}</p>
            </div>
          </section>

          <section className="plate plate-flip">
            <Image
              src="/art/supper.jpg"
              alt="Watercolor of a candlelit holiday supper indoors, painted by Jenny Nyström"
              width={1100}
              height={1676}
            />
            <div>
              <h2>Food</h2>
              <p>{event.food}</p>
            </div>
          </section>

          <section className="plate">
            <Image
              src="/art/lanterns.jpg"
              alt="Watercolor of two children walking through falling snow with candles, painted by Jenny Nyström"
              width={1100}
              height={1672}
            />
            <div>
              <h2>What to bring</h2>
              <p>{event.bring}</p>
            </div>
          </section>

          <Countdown />

          <div className="rsvp-cta">
            <p className="script">{event.rsvpHeading}</p>
            <button type="button" className="btn btn-berry" onClick={() => go("rsvp")}>
              Rsvp before November 20
            </button>
          </div>

          <footer>
            <p>
              Paintings by Jenny Nyström (1854–1946), public domain, from Wikimedia
              Commons. The bell music is an original pattern written for this card.
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
