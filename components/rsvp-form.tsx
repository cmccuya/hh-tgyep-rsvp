"use client";

import { FormEvent, useEffect, useState } from "react";
import { event } from "@/lib/event";

const STORAGE_KEY = "hearthlight-rsvp";

type Coming = "yes" | "no" | "";

type Reply = {
  name: string;
  coming: Exclude<Coming, "">;
  phone: string;
  guests: string;
};

type Errors = {
  name?: string;
  coming?: string;
  phone?: string;
  guests?: string;
};

function readReply(): Reply | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Reply;
    if (!parsed?.name || (parsed.coming !== "yes" && parsed.coming !== "no")) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function RsvpForm({ onBack }: { onBack: () => void }) {
  const [name, setName] = useState("");
  const [coming, setComing] = useState<Coming>("");
  const [phone, setPhone] = useState("");
  const [guests, setGuests] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [saved, setSaved] = useState<Reply | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const existing = readReply();
    if (existing) setSaved(existing);
    setReady(true);
  }, []);

  function validate(): Errors {
    const next: Errors = {};
    if (!name.trim()) next.name = "Please tell us your name.";
    if (!coming) next.coming = "Let us know if you can come.";
    const digits = phone.replace(/\D/g, "");
    if (phone.trim() && digits.length < 7) {
      next.phone = "That number looks short. Add the full phone number, or leave it blank.";
    }
    if (guests.trim()) {
      const count = Number(guests);
      if (!Number.isInteger(count) || count < 1 || count > 30) {
        next.guests = "Enter a number of guests from 1 to 30.";
      }
    }
    return next;
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length || !coming) return;
    const reply: Reply = {
      name: name.trim(),
      coming,
      phone: phone.trim(),
      guests: guests.trim(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reply));
    setSaved(reply);
  }

  function edit() {
    if (!saved) return;
    setName(saved.name);
    setComing(saved.coming);
    setPhone(saved.phone);
    setGuests(saved.guests);
    setSaved(null);
    setErrors({});
  }

  if (!ready) {
    return (
      <div className="sheet rsvp-sheet">
        <p className="quiet">Opening the reply card…</p>
      </div>
    );
  }

  if (saved) {
    const comingYes = saved.coming === "yes";
    return (
      <div className="sheet rsvp-sheet">
        <p className="eyebrow">Rsvp</p>
        <h2>{comingYes ? "We'll save you a seat." : "We'll miss you."}</h2>
        <p className="lede">
          {comingYes
            ? `${saved.name}, the Parker family has your yes${
                saved.guests ? ` for ${saved.guests} ${saved.guests === "1" ? "guest" : "guests"}` : ""
              }.`
            : `${saved.name}, thank you for telling us.`}
        </p>
        <p className="quiet">
          This reply stays on this phone. It is not sent to a shared guest list.
        </p>
        <div className="row-actions">
          <button type="button" className="btn btn-ink" onClick={edit}>
            Change my reply
          </button>
          <button type="button" className="btn btn-ghost" onClick={onBack}>
            Back to the party
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className="sheet rsvp-sheet" onSubmit={onSubmit} noValidate>
      <p className="eyebrow script">Rsvp</p>
      <h2>{event.rsvpBy}</h2>
      <p className="quiet">The Parker family would love to know.</p>

      <label className="field">
        <span>Your name*</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          aria-invalid={Boolean(errors.name)}
        />
        {errors.name ? <em>{errors.name}</em> : null}
      </label>

      <fieldset>
        <legend>Are you coming?*</legend>
        <div role="radiogroup" aria-label="Are you coming?" className="choices">
          <button
            type="button"
            role="radio"
            aria-checked={coming === "yes"}
            className={coming === "yes" ? "choice on" : "choice"}
            onClick={() => setComing("yes")}
          >
            Yes! I&apos;ll be there
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={coming === "no"}
            className={coming === "no" ? "choice on" : "choice"}
            onClick={() => setComing("no")}
          >
            Can&apos;t make it this time
          </button>
        </div>
        {errors.coming ? <em className="field-error">{errors.coming}</em> : null}
      </fieldset>

      <label className="field">
        <span>
          Please share your phone number so we can reach out with updates if needed
        </span>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="tel"
          autoComplete="tel"
          aria-invalid={Boolean(errors.phone)}
        />
        {errors.phone ? <em>{errors.phone}</em> : null}
      </label>

      <label className="field">
        <span>Number of guests</span>
        <input
          value={guests}
          onChange={(e) => setGuests(e.target.value.replace(/[^\d]/g, ""))}
          inputMode="numeric"
          aria-invalid={Boolean(errors.guests)}
        />
        {errors.guests ? <em>{errors.guests}</em> : null}
      </label>

      <div className="row-actions">
        <button type="submit" className="btn btn-ink">
          Submit
        </button>
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          Back to the party
        </button>
      </div>
    </form>
  );
}
