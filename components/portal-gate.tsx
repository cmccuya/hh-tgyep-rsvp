"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const STORAGE_KEY = "hamana-portal";

export type Household = {
  name: string;
  blockLot: string;
};

export function readHousehold(): Household | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Household>;
    if (!parsed.name || !parsed.blockLot) return null;
    return { name: parsed.name, blockLot: parsed.blockLot };
  } catch {
    return null;
  }
}

export function Gate() {
  const router = useRouter();
  const [name, setName] = useState("Cinderella Cuya");
  const [blockLot, setBlockLot] = useState("38-16");
  const [error, setError] = useState("");

  function enter(event: FormEvent) {
    event.preventDefault();
    const household = { name: name.trim(), blockLot: blockLot.trim() };
    if (!household.name || !household.blockLot) {
      setError("Add your name and your block and lot.");
      return;
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(household));
    router.push("/dashboard");
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
        <p className="eyebrow">Resident gate</p>
        <h2>Come in, neighbor.</h2>
        <p className="lede">The notice board, the club house calendar, and your household live just inside.</p>
        <form onSubmit={enter}>
          <label>
            Your name
            <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
          </label>
          <label>
            Block and lot
            <input value={blockLot} onChange={(event) => setBlockLot(event.target.value)} autoComplete="off" />
          </label>
          {error ? <p className="gate-error">{error}</p> : null}
          <button type="submit">Step inside</button>
        </form>
      </section>
    </main>
  );
}
