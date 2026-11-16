"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { portalApi } from "@/components/portal-gate";

export function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [blockLot, setBlockLot] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function ask(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password || !name.trim() || !phone.trim() || !blockLot.trim()) {
      setError("Add your email, password, name, phone number, and block and lot.");
      return;
    }
    const url = portalApi("/auth/register");
    if (!url) {
      setError("The gate is not connected yet.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          name: name.trim(),
          phone: phone.trim(),
          blockLot: blockLot.trim(),
        }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(body.error || "The office could not take that request.");
        return;
      }
      setSent(true);
    } catch {
      setError("The gate could not be reached. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="portal gate">
      <section className="gate-yard" aria-hidden="true">
        <p className="gate-mark">The village gate</p>
        <h1>Hamana Homes</h1>
        <p>Sto. Rosario, Magalang, Pampanga</p>
        <div className="gate-arch">
          <span />
          <i />
          <i />
        </div>
      </section>
      <section className="gate-card">
        <p className="eyebrow">New household</p>
        <h2>Ask for a key.</h2>
        {sent ? (
          <>
            <p className="lede">The office has your name. An admin still has to approve it before you can sign in.</p>
            <p className="gate-switch">
              <Link href="/login">Back to the gate</Link>
            </p>
          </>
        ) : (
          <>
            <p className="lede">Send your household details. You can come in after an admin approves the account.</p>
            <form onSubmit={ask}>
              <label>
                Email
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
              </label>
              <label>
                Password
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" />
              </label>
              <label>
                Name
                <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
              </label>
              <label>
                Phone number
                <input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" placeholder="0917 000 0000" />
              </label>
              <label>
                Block and lot
                <input value={blockLot} onChange={(event) => setBlockLot(event.target.value)} placeholder="38-16" />
              </label>
              {error ? <p className="gate-error">{error}</p> : null}
              <button type="submit" disabled={pending}>{pending ? "Sending…" : "Ask for an account"}</button>
            </form>
            <p className="gate-switch">
              Already approved? <Link href="/login">Sign in</Link>
            </p>
          </>
        )}
      </section>
    </main>
  );
}
