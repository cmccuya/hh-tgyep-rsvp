"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useInView<T extends HTMLElement>(threshold = 0.2) {
  const [shown, setShown] = useState(false);
  const observer = useRef<IntersectionObserver | null>(null);

  useEffect(() => () => observer.current?.disconnect(), []);

  const ref = useCallback(
    (node: T | null) => {
      observer.current?.disconnect();
      if (!node || shown) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setShown(true);
        return;
      }
      const next = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting) {
            setShown(true);
            next.disconnect();
          }
        },
        { threshold, rootMargin: "0px 0px -4% 0px" },
      );
      observer.current = next;
      next.observe(node);
    },
    [shown, threshold],
  );

  return { ref, shown };
}

export function WriteIn({
  text,
  delay = 0,
  active = true,
}: {
  text: string;
  delay?: number;
  active?: boolean;
}) {
  return (
    <span aria-hidden="true">
      {Array.from(text).map((char, index) => (
        <span
          key={`${char}-${index}`}
          className="write-ch"
          style={{
            animationDelay: `${delay + index * 35}ms`,
            animationPlayState: active ? "running" : "paused",
          }}
        >
          {char === " " ? "\u00A0" : char}
        </span>
      ))}
    </span>
  );
}

export function RiseIn({
  text,
  delay = 0,
  active = true,
}: {
  text: string;
  delay?: number;
  active?: boolean;
}) {
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <span aria-hidden="true">
      {words.map((word, index) => (
        <span
          key={`${word}-${index}`}
          className="rise-word"
          style={{
            animationDelay: `${delay + index * 120}ms`,
            animationPlayState: active ? "running" : "paused",
          }}
        >
          {word}
        </span>
      ))}
    </span>
  );
}

export function wordDelay(text: string, extra = 0) {
  return text.split(/\s+/).filter(Boolean).length * 120 + extra;
}

export function letterDelay(text: string, extra = 0) {
  return Array.from(text).length * 35 + extra;
}
