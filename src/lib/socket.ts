"use client";

import { io, Socket } from "socket.io-client";

const SIGNALING_URL =
  process.env.NEXT_PUBLIC_SIGNALING_URL || "http://localhost:4000";

let socket: Socket | null = null;

/**
 * Returns a singleton Socket.IO connection to the signaling server.
 * Created lazily on first call (client-side only).
 */
export function getSocket(): Socket {
  if (!socket) {
    socket = io(SIGNALING_URL, {
      transports: ["websocket"],
      autoConnect: true,
    });
  }
  return socket;
}

/**
 * Generates and persists an anonymous display name + id for guest users,
 * so a refresh doesn't give them a brand new identity mid-session.
 */
export function getGuestIdentity(): { displayName: string; guestId: string } {
  if (typeof window === "undefined") {
    return { displayName: "Guest", guestId: "" };
  }

  const existing = window.localStorage.getItem("lectern_guest_identity");
  if (existing) {
    return JSON.parse(existing);
  }

  const guestId = crypto.randomUUID();
  const displayName = `Guest${Math.floor(1000 + Math.random() * 9000)}`;
  const identity = { displayName, guestId };
  window.localStorage.setItem("lectern_guest_identity", JSON.stringify(identity));
  return identity;
}
