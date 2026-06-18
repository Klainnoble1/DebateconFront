"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { MatchFoundPayload } from "@/lib/types";

export default function JoinPage() {
  return (
    <Suspense
      fallback={
        <main className="flex-1 flex items-center justify-center paper-texture">
          <p className="font-display italic text-xl">Preparing debate access...</p>
        </main>
      }
    >
      <JoinContent />
    </Suspense>
  );
}

function JoinContent() {
  const router = useRouter();
  const params = useSearchParams();
  const payload = params.get("payload");
  const [error, setError] = useState(() => (payload ? "" : "Missing join payload."));

  useEffect(() => {
    if (!payload) {
      return;
    }

    try {
      const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
      const match = JSON.parse(json) as MatchFoundPayload;
      sessionStorage.setItem("lectern_match", JSON.stringify(match));
      router.replace(`/debate/${match.roomName}`);
    } catch {
      queueMicrotask(() => {
        setError("This join link is invalid or expired.");
      });
    }
  }, [payload, router]);

  return (
    <main className="flex-1 flex items-center justify-center paper-texture px-6">
      <div className="max-w-md text-center">
        <h1 className="font-display text-3xl italic text-ink mb-3">
          Joining debate
        </h1>
        <p className="font-body text-sm text-ink-soft">
          {error || "Opening the room now."}
        </p>
      </div>
    </main>
  );
}
