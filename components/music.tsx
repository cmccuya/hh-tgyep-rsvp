"use client";

import { useEffect, useRef, useState } from "react";
import { event } from "@/lib/event";

type Player = {
  playVideo: () => void;
  pauseVideo: () => void;
};

declare global {
  interface Window {
    YT?: {
      Player: new (
        id: string,
        options: {
          videoId: string;
          playerVars: Record<string, number | string>;
          events: { onReady: () => void };
        },
      ) => Player;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

export function useCarol() {
  const player = useRef<Player | null>(null);
  const queued = useRef(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    let cancelled = false;

    function mount() {
      if (cancelled || player.current || !window.YT?.Player) return;
      if (!document.getElementById("carol-player")) return;
      player.current = new window.YT.Player("carol-player", {
        videoId: event.videoId,
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          loop: 1,
          playlist: event.videoId,
        },
        events: {
          onReady: () => {
            if (queued.current) {
              player.current?.playVideo();
              setPlaying(true);
            }
          },
        },
      });
    }

    if (window.YT?.Player) {
      mount();
    } else {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previous?.();
        mount();
      };
      if (!document.querySelector("script[data-carol]")) {
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        tag.dataset.carol = "true";
        document.body.appendChild(tag);
      }
    }

    return () => {
      cancelled = true;
    };
  }, []);

  function play() {
    queued.current = true;
    player.current?.playVideo();
    setPlaying(true);
  }

  function pause() {
    queued.current = false;
    player.current?.pauseVideo();
    setPlaying(false);
  }

  return { playing, play, pause };
}

export function CarolFrame() {
  return <div id="carol-player" className="carol-frame" />;
}
