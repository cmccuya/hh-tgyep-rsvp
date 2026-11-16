"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const PROFILE_KEY = "hamana-portal";
const TOKEN_KEY = "hamana-portal-token";

export type Household = {
  name: string;
  blockLot: string;
  email: string;
  role?: "admin" | "resident";
};

export function readHousehold(): Household | null {
  try {
    const raw = sessionStorage.getItem(PROFILE_KEY);
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (!raw || !token) return null;
    const parsed = JSON.parse(raw) as Partial<Household>;
    if (!parsed.name || !parsed.blockLot || !parsed.email) return null;
    return { name: parsed.name, blockLot: parsed.blockLot, email: parsed.email };
  } catch {
    return null;
  }
}

export function authHeader(): Record<string, string> {
  const token = sessionStorage.getItem(TOKEN_KEY);
  return token ? { authorization: `Bearer ${token}` } : {};
}

export function portalApi(path: string) {
  const base = process.env.NEXT_PUBLIC_RSVP_URL;
  if (!base) return "";
  return new URL(path, base).href;
}

export function Gate() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function enter(event: FormEvent) {
    event.preventDefault();
    const address = email.trim().toLowerCase();
    if (!address || !password) {
      setError("Enter your email and password.");
      return;
    }
    const url = portalApi("/auth/login");
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
        body: JSON.stringify({ email: address, password }),
      });
      const body = (await response.json()) as {
        token?: string;
        name?: string;
        blockLot?: string;
        email?: string;
        role?: "admin" | "resident";
        error?: string;
      };
      if (!response.ok || !body.token || !body.name || !body.blockLot) {
        setError(body.error || "That email or password does not match an account.");
        return;
      }
      sessionStorage.setItem(TOKEN_KEY, body.token);
      sessionStorage.setItem(
        PROFILE_KEY,
        JSON.stringify({ name: body.name, blockLot: body.blockLot, email: body.email || address, role: body.role || "resident" }),
      );
      router.push("/dashboard");
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
        <p className="eyebrow">Resident account</p>
        <h2>Come in, neighbor.</h2>
        <p className="lede">Only a household with an account can open the notice board.</p>
        <form onSubmit={enter}>
          <label>
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
          </label>
          {error ? <p className="gate-error">{error}</p> : null}
          <button type="submit" disabled={pending}>{pending ? "Checking…" : "Sign in"}</button>
        </form>
        <p className="gate-switch">
          New here? <Link href="/register">Ask for an account</Link>
        </p>
      </section>
    </main>
  );
}
