"use client";

import { FormEvent, useState } from "react";
import { authHeader, portalApi } from "@/components/portal-gate";

export type Post = {
  id: string;
  kind: "notice" | "event" | "paper";
  tag: string;
  title: string;
  when: string;
  body: string;
};

const shelves: { id: Post["kind"]; label: string; hint: string }[] = [
  { id: "notice", label: "Notices", hint: "This goes on the notice board." },
  { id: "event", label: "Events", hint: "This goes on the events page." },
  { id: "paper", label: "Papers", hint: "This goes with the village papers." },
];

export function Desk({ posts, onChange }: { posts: Post[]; onChange: (posts: Post[]) => void }) {
  const [kind, setKind] = useState<Post["kind"]>("notice");
  const [editing, setEditing] = useState("");
  const [tag, setTag] = useState("");
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const shelf = shelves.find((item) => item.id === kind) || shelves[0];
  const visible = posts.filter((post) => post.kind === kind);

  function fill(post?: Post) {
    setEditing(post?.id || "");
    setTag(post?.tag || "");
    setTitle(post?.title || "");
    setWhen(post?.when || "");
    setMessage(post?.body || "");
    setError("");
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() || !message.trim()) {
      setError("Add a title and a message.");
      return;
    }
    const url = portalApi("/admin/posts");
    if (!url) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeader() },
        body: JSON.stringify({ id: editing, kind, tag, title, when, body: message }),
      });
      const body = (await response.json()) as { posts?: Post[]; error?: string };
      if (!response.ok || !body.posts) {
        setError(body.error || "The desk could not save that.");
        return;
      }
      onChange(body.posts);
      fill();
    } catch {
      setError("The desk could not be reached. Try again.");
    } finally {
      setPending(false);
    }
  }

  async function remove(post: Post) {
    if (!window.confirm(`Take down “${post.title}”?`)) return;
    const url = portalApi("/admin/posts");
    if (!url) return;
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeader() },
      body: JSON.stringify({ action: "remove", id: post.id }),
    });
    if (!response.ok) return;
    const body = (await response.json()) as { posts?: Post[] };
    if (body.posts) onChange(body.posts);
    if (editing === post.id) fill();
  }

  return (
    <article className="letter">
      <p className="eyebrow">Desk</p>
      <h1>Post for the village.</h1>
      <div className="desk-tabs">
        {shelves.map((item) => (
          <button key={item.id} type="button" className={kind === item.id ? "on" : ""} onClick={() => { setKind(item.id); fill(); }}>
            {item.label}
          </button>
        ))}
      </div>
      <p className="lede">{shelf.hint}</p>
      <form className="composer" onSubmit={send}>
        <label>
          Label
          <input value={tag} onChange={(event) => setTag(event.target.value)} placeholder="Water" />
        </label>
        <label>
          Title
          <input value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label>
          Date
          <input value={when} onChange={(event) => setWhen(event.target.value)} placeholder="Dec 19" />
        </label>
        <label>
          Message
          <textarea value={message} onChange={(event) => setMessage(event.target.value)} />
        </label>
        {error ? <p className="gate-error">{error}</p> : null}
        <div className="composer-actions">
          <button type="submit" disabled={pending}>{pending ? "Saving…" : editing ? "Save changes" : "Post"}</button>
          {editing ? (
            <button type="button" className="quiet" onClick={() => fill()}>
              Cancel
            </button>
          ) : null}
        </div>
      </form>
      {visible.length ? (
        <ul className="roster">
          {visible.map((post) => (
            <li key={post.id}>
              <div>
                <strong>{post.title}</strong>
                <p>
                  {[post.tag, post.when].filter(Boolean).join(" · ")}
                </p>
              </div>
              <div className="composer-actions">
                <button type="button" className="quiet" onClick={() => { setKind(post.kind); fill(post); }}>
                  Edit
                </button>
                <button type="button" onClick={() => remove(post)}>
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p>Nothing is posted here yet.</p>
      )}
    </article>
  );
}
