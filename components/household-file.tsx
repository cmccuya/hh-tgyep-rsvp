"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authHeader, portalApi, readHousehold } from "@/components/portal-gate";

type File = {
  email: string;
  name: string;
  phone: string;
  blockLot: string;
  status: "pending" | "approved";
  role: "admin" | "resident";
  createdAt: string;
};

function filedOn(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    timeZone: "Asia/Manila",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function HouseholdFile() {
  const router = useRouter();
  const params = useSearchParams();
  const email = (params.get("email") || "").trim().toLowerCase();
  const [file, setFile] = useState<File | null>(null);
  const [missing, setMissing] = useState("");
  const [viewer, setViewer] = useState("");

  useEffect(() => {
    const saved = readHousehold();
    const me = portalApi("/auth/me");
    const url = email ? portalApi(`/admin/account?email=${encodeURIComponent(email)}`) : "";
    if (!saved || !me || !url) {
      router.replace("/login");
      return;
    }
    fetch(me, { headers: authHeader() })
      .then(async (response) => {
        const account = (await response.json()) as { role?: string };
        if (!response.ok || account.role !== "admin") {
          router.replace("/dashboard");
          return;
        }
        setViewer((account as { email?: string }).email || saved.email);
        const detail = await fetch(url, { headers: authHeader() });
        const body = (await detail.json()) as { account?: File; error?: string };
        if (!detail.ok || !body.account) {
          setMissing(body.error || "That household is not here.");
          return;
        }
        setFile(body.account);
      })
      .catch(() => setMissing("The household file could not be opened."));
  }, [email, router]);

  const standing = !file
    ? ""
    : file.role === "admin"
      ? "Admin"
      : file.status === "approved"
        ? "Can sign in"
        : "Waiting for approval";

  return (
    <main className="portal household-file">
      <article className="letter">
        <p className="eyebrow">Household file</p>
        <h1>{file?.name || "Opening the file."}</h1>
        <p className="gate-switch">
          <Link href="/dashboard">Back to the village</Link>
        </p>
        {missing ? <p>{missing}</p> : null}
        {file ? (
          <dl className="facts">
            <div>
              <dt>Name</dt>
              <dd>{file.name}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>
                <a href={`mailto:${file.email}`}>{file.email}</a>
              </dd>
            </div>
            <div>
              <dt>Phone number</dt>
              <dd>{file.phone ? <a href={`tel:${file.phone}`}>{file.phone}</a> : "Not given"}</dd>
            </div>
            <div>
              <dt>Block and lot</dt>
              <dd>{file.blockLot}</dd>
            </div>
            <div>
              <dt>Place</dt>
              <dd>Hamana Homes, Sto. Rosario, Magalang, Pampanga</dd>
            </div>
            <div>
              <dt>Standing</dt>
              <dd>{standing}</dd>
            </div>
            <div>
              <dt>Registered</dt>
              <dd>{filedOn(file.createdAt)}</dd>
            </div>
          </dl>
        ) : null}
        {file && file.role === "admin" && file.email !== viewer ? (
          <div className="composer-actions">
            <button
              type="button"
              onClick={async () => {
                if (!window.confirm("Remove admin access for this household?")) return;
                const url = portalApi("/admin/accounts");
                if (!url) return;
                const response = await fetch(url, {
                  method: "POST",
                  headers: { "content-type": "application/json", ...authHeader() },
                  body: JSON.stringify({ email: file.email, action: "resident" }),
                });
                if (!response.ok) return;
                setFile({ ...file, role: "resident" });
              }}
            >
              Remove admin
            </button>
          </div>
        ) : null}
      </article>
    </main>
  );
}
