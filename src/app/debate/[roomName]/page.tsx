"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { getSocket } from "@/lib/socket";
import {
  startRecording,
  startStreaming,
  stopRecording,
  stopStreaming,
} from "@/lib/signalingApi";
import type { MatchFoundPayload } from "@/lib/types";

const DebateRoom = dynamic(() => import("@/components/DebateRoom"), { ssr: false });
const ChatPanel = dynamic(() => import("@/components/ChatPanel"), { ssr: false });

function readStoredMatch(expectedRoomName: string): MatchFoundPayload | null {
  if (typeof window === "undefined") return null;
  const stored = sessionStorage.getItem("lectern_match");
  if (!stored) return null;
  try {
    const parsed: MatchFoundPayload = JSON.parse(stored);
    if (parsed.roomName !== expectedRoomName) return null;
    return parsed;
  } catch {
    return null;
  }
}

export default function DebateRoomPage() {
  const router = useRouter();
  const params = useParams<{ roomName: string }>();
  const [match] = useState<MatchFoundPayload | null>(() => readStoredMatch(params.roomName));
  const [recordingStatus, setRecordingStatus] = useState("idle");
  const [recordingMessage, setRecordingMessage] = useState("");
  const [streamingStatus, setStreamingStatus] = useState("idle");
  const [streamingMessage, setStreamingMessage] = useState("");
  const [streamPlatform, setStreamPlatform] = useState("YouTube");
  const [rtmpUrl, setRtmpUrl] = useState("");
  const [streamKey, setStreamKey] = useState("");

  useEffect(() => {
    if (!match) {
      router.replace("/");
    }
  }, [match, router]);

  function handleLeave() {
    if (!match) return;
    if (!match.audience && !match.moderator) {
      const socket = getSocket();
      socket.emit("session:end", { sessionId: match.sessionId, reason: "left_early" });
    }
    sessionStorage.removeItem("lectern_match");
    router.push("/");
  }

  async function handleStreamingToggle() {
    if (!match) return;
    setStreamingMessage("");
    try {
      const streaming =
        streamingStatus === "streaming"
          ? await stopStreaming(match.sessionId)
          : await startStreaming({
              sessionId: match.sessionId,
              platform: streamPlatform,
              rtmpUrl,
              streamKey,
            });
      setStreamingStatus(streaming?.status || "idle");
      setStreamingMessage(streaming?.message || "");
    } catch (err) {
      setStreamingStatus("failed");
      setStreamingMessage(err instanceof Error ? err.message : "Stream could not be started");
    }
  }

  async function handleRecordingToggle() {
    if (!match) return;
    setRecordingMessage("");
    try {
      const recording =
        recordingStatus === "recording"
          ? await stopRecording(match.sessionId)
          : await startRecording(match.sessionId);
      setRecordingStatus(recording?.status || "idle");
      setRecordingMessage(recording?.message || "");
    } catch (err) {
      setRecordingStatus("setup_required");
      setRecordingMessage(
        err instanceof Error ? err.message : "Recording could not be started"
      );
    }
  }

  if (!match) {
    return (
      <main className="flex-1 flex items-center justify-center bg-ink">
        <p className="font-display italic text-paper text-xl">Loading the chamber...</p>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col bg-ink h-screen">
      <div className="bg-paper paper-texture px-6 py-5 border-b-2 border-ink">
        <div className="max-w-5xl mx-auto flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft mb-1">
              {match.audience ? "Listening live" : match.moderator ? "Moderating live" : "The motion"}
            </p>
            <h1 className="font-display text-2xl italic text-ink leading-tight">
              {match.topic?.title || "Open debate - no fixed motion"}
            </h1>
            {recordingMessage && (
              <p className="font-body text-xs text-ink-soft mt-2">{recordingMessage}</p>
            )}
            {streamingMessage && (
              <p className="font-body text-xs text-ink-soft mt-1">{streamingMessage}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!match.audience && (
              <button
                onClick={handleRecordingToggle}
                className={`font-mono text-xs uppercase tracking-wide border px-4 py-2 rounded-sm transition-colors ${
                  recordingStatus === "recording"
                    ? "border-side-a text-side-a hover:bg-side-a hover:text-paper"
                    : "border-ink text-ink hover:bg-ink hover:text-paper"
                }`}
              >
                {recordingStatus === "recording" ? "Stop recording" : "Record"}
              </button>
            )}
            <button
              onClick={handleLeave}
              className="font-mono text-xs uppercase tracking-wide border border-side-a text-side-a px-4 py-2 rounded-sm hover:bg-side-a hover:text-paper transition-colors"
            >
              Leave
            </button>
          </div>
        </div>
        {!match.audience && (
          <div className="max-w-5xl mx-auto mt-4 grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)_minmax(0,1fr)_auto]">
            <select
              value={streamPlatform}
              onChange={(e) => setStreamPlatform(e.target.value)}
              className="bg-paper border border-line rounded-sm px-3 py-2 text-sm font-body"
            >
              <option>YouTube</option>
              <option>Facebook</option>
              <option>X</option>
              <option>TikTok</option>
              <option>RTMP</option>
            </select>
            <input
              value={rtmpUrl}
              onChange={(e) => setRtmpUrl(e.target.value)}
              className="bg-paper border border-line rounded-sm px-3 py-2 text-sm font-body"
              placeholder="RTMP server URL"
            />
            <input
              value={streamKey}
              onChange={(e) => setStreamKey(e.target.value)}
              className="bg-paper border border-line rounded-sm px-3 py-2 text-sm font-body"
              placeholder="Stream key"
              type="password"
            />
            <button
              onClick={handleStreamingToggle}
              disabled={streamingStatus !== "streaming" && !rtmpUrl.trim()}
              className={`font-mono text-xs uppercase tracking-wide border px-4 py-2 rounded-sm transition-colors disabled:opacity-40 ${
                streamingStatus === "streaming"
                  ? "border-side-a text-side-a hover:bg-side-a hover:text-paper"
                  : "border-side-b text-side-b hover:bg-side-b hover:text-paper"
              }`}
            >
              {streamingStatus === "streaming" ? "Stop stream" : "Go live"}
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <div className="flex-1 min-h-[50vh] lg:min-h-0">
          <DebateRoom
            livekitUrl={match.livekitUrl}
            token={match.token}
            yourSide={match.yourSide}
            opponentSide={match.opponent.side}
            opponentName={match.opponent.displayName}
            audience={Boolean(match.audience)}
            onDisconnected={handleLeave}
          />
        </div>
        <div className="w-full lg:w-80 shrink-0 p-3 bg-paper-dim">
          <ChatPanel
            roomName={match.roomName}
            sessionId={match.sessionId}
            displayName={getDisplayNameFromStorage()}
            readOnly={Boolean(match.audience)}
          />
        </div>
      </div>
    </main>
  );
}

function getDisplayNameFromStorage(): string {
  if (typeof window === "undefined") return "You";
  const raw = window.localStorage.getItem("lectern_guest_identity");
  if (!raw) return "You";
  try {
    return JSON.parse(raw).displayName || "You";
  } catch {
    return "You";
  }
}
