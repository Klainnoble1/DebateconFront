"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSocket } from "@/lib/socket";
import type { DebateMode, MatchFoundPayload, Side } from "@/lib/types";

const SEARCH_MESSAGES = [
  "Scanning the chamber for an opponent…",
  "Checking who else is making their case…",
  "Lining up Debate Con...",
  "Almost there — sharpening arguments…",
];

export default function QueuePage() {
  return (
    <Suspense
      fallback={
        <main className="flex-1 paper-texture flex items-center justify-center">
          <p className="font-display italic text-ink text-xl">Loading…</p>
        </main>
      }
    >
      <QueueContent />
    </Suspense>
  );
}

function QueueContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [statusMessage, setStatusMessage] = useState(SEARCH_MESSAGES[0]);
  const [elapsed, setElapsed] = useState(0);
  const hasJoined = useRef(false);

  const mode = (params.get("mode") as DebateMode) || "random";
  const name = params.get("name") || "Guest";
  const topicId = params.get("topicId");
  const side = params.get("side") as Side | null;
  const moderatorRequested = params.get("moderator") === "1";
  const inviteCode = params.get("invite");

  useEffect(() => {
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
    const messageRotator = setInterval(() => {
      setStatusMessage(SEARCH_MESSAGES[Math.floor(Math.random() * SEARCH_MESSAGES.length)]);
    }, 4000);

    const socket = getSocket();

    function handleMatchFound(payload: MatchFoundPayload) {
      // Stash the match payload so the debate room page can pick it up.
      sessionStorage.setItem("lectern_match", JSON.stringify(payload));
      router.push(`/debate/${payload.roomName}`);
    }

    socket.on("match:found", handleMatchFound);

    if (!hasJoined.current) {
      hasJoined.current = true;
      socket.emit(
        "queue:join",
        {
          displayName: name,
          userId: null, // wire up real user id once auth is added
          mode,
          topicId: topicId || null,
          side: side || null,
          moderatorRequested,
          inviteCode,
        },
        (res: { error?: string }) => {
          if (res?.error) {
            console.error("Failed to join queue:", res.error);
          }
        }
      );
    }

    return () => {
      clearInterval(timer);
      clearInterval(messageRotator);
      socket.off("match:found", handleMatchFound);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleCancel() {
    const socket = getSocket();
    socket.emit("queue:leave", {}, () => {
      router.push("/");
    });
  }

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  return (
    <main className="flex-1 paper-texture flex items-center justify-center">
      <div className="max-w-md w-full px-6 text-center">
        <div className="mb-10 flex justify-center">
          <PulsingMark />
        </div>

        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft mb-3">
          {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
        </p>
        <h1 className="font-display text-3xl italic text-ink mb-4">{statusMessage}</h1>
        <p className="font-body text-sm text-ink-soft mb-12">
          You&apos;ll be dropped straight into the room the moment someone else takes the floor.
        </p>

        <button
          onClick={handleCancel}
          className="font-mono text-xs uppercase tracking-[0.15em] text-ink-soft border border-line rounded-sm px-6 py-3 hover:border-side-a hover:text-side-a transition-colors"
        >
          Cancel and leave
        </button>
      </div>
    </main>
  );
}

function PulsingMark() {
  return (
    <div className="relative w-16 h-16">
      <span className="absolute inset-0 rounded-full border-2 border-side-a animate-ping opacity-30" />
      <span className="absolute inset-0 rounded-full border-2 border-side-b animate-ping opacity-30 [animation-delay:0.6s]" />
      <span className="absolute inset-3 rounded-full bg-ink" />
    </div>
  );
}
