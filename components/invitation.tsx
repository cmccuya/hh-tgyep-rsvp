"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { RiseIn, WriteIn, letterDelay, useInView, wordDelay } from "@/components/motion";
import { Countdown } from "@/components/countdown";
import { CarolFrame, useCarol } from "@/components/music";
import { RsvpForm } from "@/components/rsvp-form";
import { Snow } from "@/components/snow";
import { event } from "@/lib/event";

type View = "cover" | "party" | "rsvp";

function viewFromHash(): View {
  if (window.location.hash === "#rsvp") return "rsvp";
  if (window.location.hash === "#party") return "party";
  return "cover";
}

export function Invitation() {
  const [view, setView] = useState<View>("cover");
  const [lifting, setLifting] = useState(false);
  const carol = useCarol();
  const date = useInView<HTMLDivElement>();
  const place = useInView<HTMLElement>();
  const tree = useInView<HTMLDivElement>();
  const food = useInView<HTMLElement>();
  const gift = useInView<HTMLElement>();
  const sleigh = useInView<HTMLDivElement>();
  const games = useInView<HTMLElement>();
  const input = useInView<HTMLDivElement>();
  const reply = useInView<HTMLDivElement>();

  useEffect(() => {
    const apply = () => setView(viewFromHash());
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  useEffect(() => {
    const rsvpUrl = process.env.NEXT_PUBLIC_RSVP_URL;
    if (!rsvpUrl) return;
    const visitUrl = new URL("/visit", rsvpUrl).href;
    let sessionId = sessionStorage.getItem("hamana-visit-id");
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      sessionStorage.setItem("hamana-visit-id", sessionId);
    }
    let started = Number(sessionStorage.getItem("hamana-visit-start") || 0);
    if (!started) {
      started = Date.now();
      sessionStorage.setItem("hamana-visit-start", String(started));
    }
    const send = () => {
      const seconds = Math.max(0, Math.round((Date.now() - started) / 1000));
      const page = window.location.hash === "#rsvp" ? "RSVP" : window.location.hash === "#party" ? "Party" : "Cover";
      const payload = JSON.stringify({ sessionId, seconds, page });
      if (navigator.sendBeacon) {
        navigator.sendBeacon(visitUrl, new Blob([payload], { type: "text/plain" }));
        return;
      }
      fetch(visitUrl, {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: payload,
        keepalive: true,
      }).catch(() => undefined);
    };
    send();
    const timer = window.setInterval(send, 15000);
    const onHide = () => {
      if (document.visibilityState === "hidden") send();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", send);
    window.addEventListener("hashchange", send);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", send);
      window.removeEventListener("hashchange", send);
    };
  }, []);

  function go(next: View) {
    setLifting(false);
    window.location.hash = next === "cover" ? "" : `#${next}`;
    window.scrollTo(0, 0);
  }

  function openCard() {
    window.location.hash = "#party";
    window.scrollTo(0, 0);
    carol.play();
  }

  function openReply() {
    if (lifting) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      go("rsvp");
      return;
    }
    setLifting(true);
    window.setTimeout(() => go("rsvp"), 420);
  }

  const titleDelay = 160;
  const welcomeDelay = titleDelay + letterDelay(event.title, 40);

  return (
    <div className="stage">
      <Snow />
      <CarolFrame />

      {view === "cover" ? (
        <section className="cover rise" key="cover">
          <Image className="cover-bg" src="/art/snow.jpg" alt="" fill priority sizes="100vw" />
          <div className="cover-inner">
            <div className="crest">
              <div className="crest-sway">
                <Image className="garland" src="/art/garland.png" alt="" width={1000} height={558} priority />
              </div>
            </div>
            <p className="eyebrow light" aria-label="You're invited">
              <RiseIn text="You're invited" />
            </p>
            <h1 aria-label={event.host}>
              <WriteIn text={event.host} delay={titleDelay} />
            </h1>
            <p className="cover-title" aria-label={event.title}>
              <WriteIn text={event.title} delay={titleDelay + letterDelay(event.host, 80)} />
            </p>
            <button type="button" className="mailbox" onClick={openCard} aria-label="Click to open">
              <Image src="/art/mailbox.png" alt="" width={422} height={786} priority />
            </button>
          </div>
        </section>
      ) : null}

      {view === "party" ? (
        <article className="sheet rise" key="party">
          <MusicToggle playing={carol.playing} onToggle={() => (carol.playing ? carol.pause() : carol.play())} />
          <div className="crest">
            <div className="crest-sway">
              <Image className="garland" src="/art/garland.png" alt="" width={1000} height={558} />
            </div>
          </div>

          <div className="frame frame-bow">
            <Image src="/art/bow.png" alt="" width={1000} height={1339} />
            <div className="frame-copy">
              <p className="eyebrow" aria-label={event.host}>
                <RiseIn text={event.host} />
              </p>
              <h1 aria-label={event.title}>
                <WriteIn text={event.title} delay={titleDelay} />
              </h1>
              <p aria-label={event.welcome}>
                <RiseIn text={event.welcome} delay={welcomeDelay} />
              </p>
            </div>
          </div>

          <div className="plaque" ref={date.ref}>
            <Image src="/art/plaque.png" alt="" width={1000} height={558} />
            <div className="plaque-copy">
              <p aria-label={event.dateLabel}>
                <RiseIn text={event.dateLabel} active={date.shown} />
              </p>
              <strong aria-label={`${event.dateValue}, ${event.dateTime}`}>
                <WriteIn text={event.dateValue} active={date.shown} delay={wordDelay(event.dateLabel)} />
              </strong>
              <em>{event.dateTime}</em>
            </div>
          </div>
          <Countdown />

          <section className="block" ref={place.ref}>
            <h2 aria-label={event.placeLabel}>
              <RiseIn text={event.placeLabel} active={place.shown} />
            </h2>
            <p className="place" aria-label={event.place}>
              <RiseIn text={event.place} active={place.shown} delay={wordDelay(event.placeLabel)} />
            </p>
            <p className="quiet" aria-label={event.placeDetail}>
              <RiseIn text={event.placeDetail} active={place.shown} delay={wordDelay(event.placeLabel) + wordDelay(event.place)} />
            </p>
            <a className="btn btn-berry" href={event.mapUrl} target="_blank" rel="noopener noreferrer">
              Check location
            </a>
          </section>

          <section className="block" ref={food.ref}>
            <h2 aria-label={event.foodLabel}>
              <RiseIn text={event.foodLabel} active={food.shown} />
            </h2>
            <p aria-label={event.food}>
              <RiseIn text={event.food} active={food.shown} delay={wordDelay(event.foodLabel)} />
            </p>
            <Image className="ornament feast" src="/art/feast.png" alt="Watercolor holiday feast" width={934} height={621} />
          </section>

          <section className="block" ref={gift.ref}>
            <h2 aria-label={event.giftLabel}>
              <RiseIn text={event.giftLabel} active={gift.shown} />
            </h2>
            <p aria-label={event.gift}>
              <RiseIn text={event.gift} active={gift.shown} delay={wordDelay(event.giftLabel)} />
            </p>
            <div className={`tree-slot ${tree.shown ? "in" : ""}`} ref={tree.ref}>
              <Image className="ornament tree" src="/art/tree.png" alt="Watercolor Christmas tree with wrapped gifts" width={900} height={900} />
            </div>
          </section>

          <div className={`sleigh-slot ${sleigh.shown ? "in" : ""}`} ref={sleigh.ref}>
            <div className="bob">
              <Image
                className="ornament sleigh"
                src="/art/sleigh.png"
                alt="Watercolor of Santa in a sleigh pulled by a reindeer"
                width={900}
                height={900}
              />
            </div>
          </div>

          <section className={`games ${games.shown ? "in" : ""}`} ref={games.ref}>
            <div className="pop">
              <Image className="ornament prizes" src="/art/prizes.png" alt="Hanging Christmas prizes" width={678} height={863} />
            </div>
            <div>
              <h2 aria-label={event.gamesLabel}>
                <RiseIn text={event.gamesLabel} active={games.shown} />
              </h2>
              <p aria-label={event.games}>
                <RiseIn text={event.games} active={games.shown} delay={wordDelay(event.gamesLabel)} />
              </p>
            </div>
          </section>

          <div className="frame frame-scallop" ref={input.ref}>
            <Image src="/art/scallop.png" alt="" width={1000} height={1339} />
            <div className="frame-copy">
              <h2 aria-label={event.inputLabel}>
                <WriteIn text={event.inputLabel} active={input.shown} />
              </h2>
              <p aria-label={event.input}>
                <RiseIn text={event.input} active={input.shown} delay={letterDelay(event.inputLabel, 60)} />
              </p>
            </div>
          </div>

          <div className={`rsvp-cta ${reply.shown ? "in" : ""}`} ref={reply.ref}>
            <button type="button" className="envelope-open" onClick={openReply} aria-label="Open the reply card">
              <span className="envelope-bob">
                <Image src="/art/envelope.png" alt="" width={900} height={900} />
              </span>
            </button>
            <p className="script" aria-label={event.rsvp}>
              <WriteIn text={event.rsvp} active={reply.shown} />
            </p>
            <button type="button" className="btn btn-berry" onClick={openReply}>
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
        <div className="rise" key="rsvp">
          <RsvpForm
            onBack={() => go("party")}
            toolbar={<MusicToggle playing={carol.playing} onToggle={() => (carol.playing ? carol.pause() : carol.play())} />}
          />
        </div>
      ) : null}
    </div>
  );
}

function MusicToggle({ playing, onToggle }: { playing: boolean; onToggle: () => void }) {
  return (
    <button type="button" className="music" aria-pressed={playing} onClick={onToggle}>
      <span className="note-icon">
        <Note />
        {playing ? (
          <span className="notes" aria-hidden="true">
            <i>♪</i>
            <i>♫</i>
          </span>
        ) : null}
      </span>
      <span>
        <strong>{playing ? "Pause" : "Play"}</strong>
        <small>
          {event.song}
          <br />
          {event.artist}
        </small>
      </span>
    </button>
  );
}

function Note() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
      <path
        d="M9 17.5a2.5 2.5 0 1 1-2-2.45V6.2l10-2v9.15a2.5 2.5 0 1 1-2-2.45V6.4l-6 1.2v9.9Z"
        fill="currentColor"
      />
    </svg>
  );
}
