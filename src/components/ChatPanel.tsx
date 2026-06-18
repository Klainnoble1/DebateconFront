"use client";

import { useEffect, useRef, useState } from "react";
import { getSocket } from "@/lib/socket";
import type { ChatMessage } from "@/lib/types";

const URL_PATTERN = /(https?:\/\/[^\s]+)/gi;

function renderWithLinks(body: string) {
  const parts = body.split(URL_PATTERN);
  return parts.map((part, i) => {
    if (part.match(URL_PATTERN)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-side-b underline underline-offset-2 break-all hover:text-side-a"
        >
          {part}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export default function ChatPanel({
  roomName,
  sessionId,
  displayName,
  readOnly = false,
}: {
  roomName: string;
  sessionId: string;
  displayName: string;
  readOnly?: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const socket = getSocket();
    socket.emit("room:join", { roomName });

    function handleIncoming(msg: ChatMessage) {
      if (msg.session_id !== sessionId) return;
      setMessages((prev) => [...prev, msg]);
    }

    socket.on("chat:message", handleIncoming);
    return () => {
      socket.off("chat:message", handleIncoming);
    };
  }, [roomName, sessionId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function handleSend() {
    const body = draft.trim();
    if (!body || readOnly) return;

    const socket = getSocket();
    socket.emit(
      "chat:send",
      { roomName, sessionId, displayName, userId: null, body },
      (res: { error?: string }) => {
        if (res?.error) console.error("Failed to send message:", res.error);
      }
    );
    setDraft("");
  }

  return (
    <div className="flex flex-col h-full border border-line rounded-sm bg-paper">
      <div className="px-4 py-3 border-b border-line">
        <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink-soft">
          Chat &amp; links
        </p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <p className="font-body text-sm text-ink-soft italic">
            Nothing said yet. Links and remarks appear here.
          </p>
        )}
        {messages.map((msg) => {
          const isMine = msg.sender_display_name === displayName;
          return (
            <div key={msg.id} className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
              <span className="font-mono text-[10px] text-ink-soft mb-1">
                {msg.sender_display_name}
              </span>
              <div
                className={`max-w-[85%] px-3 py-2 rounded-sm text-sm font-body break-words ${
                  isMine ? "bg-ink text-paper" : "bg-paper-dim text-ink"
                }`}
              >
                {renderWithLinks(msg.body)}
              </div>
            </div>
          );
        })}
      </div>

      {readOnly ? (
        <div className="border-t border-line p-3">
          <p className="font-mono text-[10px] uppercase tracking-wide text-ink-soft">
            Listening mode
          </p>
        </div>
      ) : (
        <div className="border-t border-line p-3 flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSend();
            }}
            placeholder="Say something, or paste a link..."
            className="flex-1 bg-paper-dim border border-line rounded-sm px-3 py-2 text-sm font-body focus:border-ink transition-colors"
          />
          <button
            onClick={handleSend}
            className="font-mono text-xs uppercase tracking-wide bg-ink text-paper px-4 rounded-sm hover:bg-side-a transition-colors"
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}
