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
    }
    return next;
  }

  function choose(next: Coming) {
    setComing(next);
    if (next === "yes" && !guests.trim()) setGuests("1");
    setErrors((current) => ({ ...current, coming: undefined, guests: next === "yes" ? current.guests : undefined }));
  }

  function stepGuests(delta: number) {
    const count = Number(guests);
    const base = Number.isInteger(count) && count >= 1 ? count : 1;
    setGuests(String(Math.min(30, Math.max(1, base + delta))));
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
      guests: coming === "yes" ? guests.trim() : "",
      potluck: coming === "yes" ? potluck.trim() : "",
      suggestions: suggestions.trim(),
    };
    setIdentity({ guestId: reply.guestId, createdAt: reply.createdAt });
    setSaving(true);
    try {
      const savedReply = await shareReply(reply);
      setIdentity({ guestId: savedReply.guestId, createdAt: savedReply.createdAt });
      setSaved(savedReply);
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
      <div className="sheet rsvp-sheet rsvp-saved">
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
        <div role="radiogroup" aria-label="Will you join us?" className="stamps">
          <button
            type="button"
            role="radio"
            aria-checked={coming === "yes"}
            className={coming === "yes" ? "stamp stamp-yes on" : "stamp stamp-yes"}
            onClick={() => choose("yes")}
          >
            <span className="stamp-spark" aria-hidden="true">
              <i /><i /><i /><i /><i /><i />
            </span>
            <span className="stamp-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 1.8 14.4 8.6h7.1l-5.7 4.2 2.2 6.8L12 15.6 6 19.6l2.2-6.8L2.5 8.6h7.1z" /></svg>
              <svg viewBox="0 0 36 18"><circle cx="8" cy="9" r="5.2" fill="none" stroke="currentColor" strokeWidth="1.8" /><circle cx="28" cy="9" r="5.2" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M13.2 9h9.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
            </span>
            <strong>Joyfully Accepts</strong>
            <small>Count us in!</small>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={coming === "no"}
            className={coming === "no" ? "stamp stamp-no on" : "stamp stamp-no"}
            onClick={() => choose("no")}
          >
            <span className="flake" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" d="M12 2.5v19M12 5.2 9.6 3M12 5.2l2.4-2.2M12 18.8 9.6 21M12 18.8l2.4 2.2M4.2 7.2l15.6 9.6M6.2 6.4 4.4 4.2M6.2 6.4l2.6.2M17.8 17.6l1.8 2.2M17.8 17.6l-2.6-.2M19.8 7.2 4.2 16.8M17.8 6.4l1.8-2.2M17.8 6.4l-2.6.2M6.2 17.6 4.4 19.8M6.2 17.6l2.6-.2" /></svg>
            </span>
            <span className="stamp-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" d="M12 2.5v19M12 5.2 9.6 3M12 5.2l2.4-2.2M12 18.8 9.6 21M12 18.8l2.4 2.2M4.2 7.2l15.6 9.6M6.2 6.4 4.4 4.2M6.2 6.4l2.6.2M17.8 17.6l1.8 2.2M17.8 17.6l-2.6-.2M19.8 7.2 4.2 16.8M17.8 6.4l1.8-2.2M17.8 6.4l-2.6.2M6.2 17.6 4.4 19.8M6.2 17.6l2.6-.2" /></svg>
            </span>
            <strong>Regretfully Declines</strong>
            <small>Will miss the fun</small>
            <em className="stamp-note" aria-hidden="true">We'll miss you at the party! 🥺</em>
          </button>
        </div>
        {errors.coming ? <em className="field-error">{errors.coming}</em> : null}
      </fieldset>

      <div className={coming === "yes" ? "party-details open" : "party-details"} inert={coming === "yes" ? undefined : true}>
        <div className="party-details-inner">
          <div className="field">
            <span id="guest-count-label">Number of guests</span>
            <small>How many in your family</small>
            <div className="stepper" role="group" aria-labelledby="guest-count-label">
              <button type="button" className="step" aria-label="Fewer guests" onClick={() => stepGuests(-1)} disabled={Number(guests) <= 1}>
                −
              </button>
              <output aria-live="polite">{guests || "1"}</output>
              <button type="button" className="step" aria-label="More guests" onClick={() => stepGuests(1)} disabled={Number(guests) >= 30}>
                +
              </button>
            </div>
            {errors.guests ? <em>{errors.guests}</em> : null}
          </div>

          <label className="field">
            <span>Potluck contributions</span>
            <textarea
              value={potluck}
              onChange={(e) => setPotluck(e.target.value)}
              rows={3}
              placeholder="A dish, a drink, or a dessert"
            />
          </label>
        </div>
      </div>

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
