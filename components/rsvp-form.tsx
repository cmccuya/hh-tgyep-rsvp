"use client";

import Image from "next/image";
import { FormEvent, useEffect, useState, type ReactNode } from "react";
import { RiseIn, WriteIn, letterDelay } from "@/components/motion";
import { readReply, shareReply, type Reply } from "@/lib/reply";

type Coming = "yes" | "no" | "";

type Errors = Partial<Record<"name" | "blockLot" | "coming" | "guests", string>>;

export function RsvpForm({ onBack, toolbar }: { onBack: () => void; toolbar?: ReactNode }) {
  const [name, setName] = useState("");
  const [blockLot, setBlockLot] = useState("");
  const [coming, setComing] = useState<Coming>("");
  const [guests, setGuests] = useState("");
  const [potluck, setPotluck] = useState("");
  const [suggestions, setSuggestions] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [saved, setSaved] = useState<Reply | null>(null);
  const [identity, setIdentity] = useState({ guestId: "", createdAt: "" });
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const existing = readReply();
    if (existing) {
      setSaved(existing);
      setIdentity({ guestId: existing.guestId, createdAt: existing.createdAt });
    }
    setReady(true);
  }, []);

  function validate(): Errors {
    const next: Errors = {};
    if (!name.trim()) next.name = "Please tell us your name.";
    if (!blockLot.trim()) next.blockLot = "Add your block and lot so we know which home.";
    if (!coming) next.coming = "Let us know if your household can join.";
    if (coming === "yes") {
      const count = Number(guests);
      if (!guests.trim() || !Number.isInteger(count) || count < 1 || count > 30) {
        next.guests = "Enter how many people are in your family, from 1 to 30.";
      }
    } else if (guests.trim()) {
      const count = Number(guests);
      if (!Number.isInteger(count) || count < 1 || count > 30) {
        next.guests = "Enter a number from 1 to 30, or leave this blank.";
      }
    }
    return next;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const next = validate();
    setErrors(next);
    setSaveError("");
    if (Object.keys(next).length || !coming) return;
    const now = new Date().toISOString();
    const reply: Reply = {
      guestId: identity.guestId || crypto.randomUUID(),
      createdAt: identity.createdAt || now,
      updatedAt: now,
      name: name.trim(),
      blockLot: blockLot.trim(),
      coming,
      guests: guests.trim(),
      potluck: potluck.trim(),
      suggestions: suggestions.trim(),
    };
    setIdentity({ guestId: reply.guestId, createdAt: reply.createdAt });
    setSaving(true);
    try {
      await shareReply(reply);
      setSaved(reply);
    } catch {
      setSaveError("We kept this reply on your phone, but it did not reach the shared list. Please submit again.");
    } finally {
      setSaving(false);
    }
  }

  function edit() {
    if (!saved) return;
    setName(saved.name);
    setBlockLot(saved.blockLot);
    setComing(saved.coming);
    setGuests(saved.guests);
    setPotluck(saved.potluck);
    setSuggestions(saved.suggestions);
    setIdentity({ guestId: saved.guestId, createdAt: saved.createdAt });
    setSaved(null);
    setErrors({});
    setSaveError("");
  }

  if (!ready) {
    return (
      <div className="sheet rsvp-sheet">
        {toolbar}
        <p className="quiet">Opening the reply card…</p>
      </div>
    );
  }

  if (saved) {
    const joining = saved.coming === "yes";
    return (
      <div className="sheet rsvp-sheet">
        {toolbar}
        <Image className="seal" src="/art/envelope.png" alt="" width={900} height={900} />
        <p className="eyebrow" aria-label="Reply received">
          <RiseIn text="Reply received" />
        </p>
        <h2 aria-label={joining ? "We'll save your household a place." : "We'll miss you."}>
          <WriteIn text={joining ? "We’ll save your household a place." : "We’ll miss you."} delay={letterDelay("Reply received", 40)} />
        </h2>
        <p className="lede">
          {joining
            ? `${saved.name}, block ${saved.blockLot}, is joyfully coming${
                saved.guests ? ` with ${saved.guests} in the family` : ""
              }.`
            : `${saved.name}, from block ${saved.blockLot}, regretfully declines. Thank you for telling us.`}
        </p>
        {saved.potluck ? <p className="quiet">Potluck note: {saved.potluck}</p> : null}
        {saved.suggestions ? <p className="quiet">Suggestion: {saved.suggestions}</p> : null}
        <p className="quiet">
          {process.env.NEXT_PUBLIC_RSVP_URL
            ? "Your household has one saved reply. Changing it updates that same reply."
            : "This reply stays on this phone. It is not sent to a shared list yet."}
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
      {toolbar}
      <Image className="seal" src="/art/envelope.png" alt="" width={900} height={900} />
      <p className="eyebrow" aria-label="Reply card">
        <RiseIn text="Reply card" />
      </p>
      <h2 aria-label="Will your household join us?">
        <WriteIn text="Will your household join us?" delay={letterDelay("Reply card", 80)} />
      </h2>

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

      <label className="field">
        <span>Block and lot*</span>
        <input
          value={blockLot}
          onChange={(e) => setBlockLot(e.target.value)}
          aria-invalid={Boolean(errors.blockLot)}
          placeholder="Block 3, Lot 12"
        />
        {errors.blockLot ? <em>{errors.blockLot}</em> : null}
      </label>

      <fieldset>
        <legend>Will you join us?*</legend>
        <div role="radiogroup" aria-label="Will you join us?" className="choices">
          <button
            type="button"
            role="radio"
            aria-checked={coming === "yes"}
            className={coming === "yes" ? "choice on" : "choice"}
            onClick={() => setComing("yes")}
          >
            Joyfully Accepts
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={coming === "no"}
            className={coming === "no" ? "choice on" : "choice"}
            onClick={() => setComing("no")}
          >
            Regretfully Declines
          </button>
        </div>
        {errors.coming ? <em className="field-error">{errors.coming}</em> : null}
      </fieldset>

      <label className="field">
        <span>Number of guests</span>
        <small>How many in your family</small>
        <input
          value={guests}
          onChange={(e) => setGuests(e.target.value.replace(/[^\d]/g, ""))}
          inputMode="numeric"
          aria-invalid={Boolean(errors.guests)}
        />
        {errors.guests ? <em>{errors.guests}</em> : null}
      </label>

      <label className="field">
        <span>Potluck contributions</span>
        <textarea
          value={potluck}
          onChange={(e) => setPotluck(e.target.value)}
          rows={3}
          placeholder="A dish, a drink, or a dessert"
        />
      </label>

      <label className="field">
        <span>Suggestions</span>
        <small>Themes, games, or activities</small>
        <textarea
          value={suggestions}
          onChange={(e) => setSuggestions(e.target.value)}
          rows={3}
        />
      </label>

      <div className="row-actions">
        {saveError ? <p className="field-error">{saveError}</p> : null}
        <button type="submit" className="btn btn-ink" disabled={saving}>
          {saving ? "Saving…" : "Submit"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          Back to the party
        </button>
      </div>
    </form>
  );
}
