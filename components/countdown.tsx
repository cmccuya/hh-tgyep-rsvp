"use client";

import { useEffect, useState } from "react";
import { event } from "@/lib/event";

type Parts = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  arrived: boolean;
};

function remaining(now: number): Parts {
  const target = new Date(event.partyAt).getTime();
  const diff = target - now;
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, arrived: true };
  }
  const seconds = Math.floor(diff / 1000);
  return {
    days: Math.floor(seconds / 86400),
    hours: Math.floor((seconds % 86400) / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    seconds: seconds % 60,
    arrived: false,
  };
}

const UNITS = [
  ["days", "Days"],
  ["hours", "Hours"],
  ["minutes", "Minutes"],
  ["seconds", "Seconds"],
] as const;

export function Countdown() {
  const [parts, setParts] = useState<Parts | null>(null);

  useEffect(() => {
    const tick = () => setParts(remaining(Date.now()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <section className="night-panel" aria-labelledby="countdown-heading">
      <h2 id="countdown-heading">{event.countdownHeading}</h2>
      {parts?.arrived ? (
        <p className="arrived">The evening has arrived.</p>
      ) : (
        <div className="ticks" aria-live="polite">
          {UNITS.map(([key, label]) => (
            <div key={key}>
              <span className="tick">
                {parts ? String(parts[key]).padStart(2, "0") : "––"}
              </span>
              <span className="tick-label">{label}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
