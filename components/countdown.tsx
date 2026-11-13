"use client";

import { useEffect, useState } from "react";

const PARTY = new Date("2026-12-19T18:00:00+08:00").getTime();

function parts(ms: number) {
  const left = Math.max(0, ms);
  return [
    [Math.floor(left / 86400000), "Days"],
    [Math.floor(left / 3600000) % 24, "Hours"],
    [Math.floor(left / 60000) % 60, "Minutes"],
    [Math.floor(left / 1000) % 60, "Seconds"],
  ] as const;
}

export function Countdown() {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  const rows = parts(now == null ? PARTY - Date.now() : PARTY - now);
  return (
    <div className="count" aria-live="polite">
      {rows.map(([value, label]) => (
        <span key={label}>
          <strong>{String(value).padStart(2, "0")}</strong>
          <small>{label}</small>
        </span>
      ))}
    </div>
  );
}
