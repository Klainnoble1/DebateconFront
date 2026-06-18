import { supabase } from "@/lib/supabaseClient";
import type { DebateInvite, LiveDebate, MatchFoundPayload, Topic } from "@/lib/types";

const SIGNALING_URL =
  process.env.NEXT_PUBLIC_SIGNALING_URL || "http://localhost:4000";

export async function loadTopics(): Promise<Topic[]> {
  const res = await fetch(`${SIGNALING_URL}/topics`);
  if (!res.ok) throw new Error("Failed to load motions");
  const data = (await res.json()) as { topics: Topic[] };
  return data.topics;
}

export async function createMotion(input: {
  title: string;
  description: string;
  sideALabel: string;
  sideBLabel: string;
}): Promise<Topic> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sign in before creating a motion");

  const res = await fetch(`${SIGNALING_URL}/topics`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });

  const payload = await res.json();
  if (!res.ok) throw new Error(payload.error || "Failed to create motion");
  return payload.topic as Topic;
}

export async function createDebateInvite(input: {
  creatorName: string;
  mode: string;
  topicId: string | null;
  side: string | null;
  moderatorRequested: boolean;
}): Promise<{ invite: DebateInvite; inviteUrl: string }> {
  const res = await fetch(`${SIGNALING_URL}/invites`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = await res.json();
  if (!res.ok) throw new Error(payload.error || "Failed to create invite");
  return payload as { invite: DebateInvite; inviteUrl: string };
}

export async function submitModeratorApplication(input: {
  reason: string;
  experience: string;
  contact: string;
}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sign in before applying to moderate");

  const res = await fetch(`${SIGNALING_URL}/moderator-applications`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });
  const payload = await res.json();
  if (!res.ok) throw new Error(payload.error || "Failed to submit moderator application");
  return payload.application;
}

export async function loadLiveDebates(): Promise<LiveDebate[]> {
  const res = await fetch(`${SIGNALING_URL}/debates/live`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load live debates");
  const data = (await res.json()) as { debates: LiveDebate[] };
  return data.debates;
}

export async function createListenerMatch(
  sessionId: string,
  displayName: string
): Promise<MatchFoundPayload> {
  const res = await fetch(`${SIGNALING_URL}/debates/${sessionId}/listen-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName }),
  });
  const payload = await res.json();
  if (!res.ok) throw new Error(payload.error || "Failed to join debate");
  return payload as MatchFoundPayload;
}

export async function createModeratorMatch(
  sessionId: string,
  displayName: string
): Promise<MatchFoundPayload> {
  const res = await fetch(`${SIGNALING_URL}/debates/${sessionId}/moderator-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName }),
  });
  const payload = await res.json();
  if (!res.ok) throw new Error(payload.error || "Failed to moderate debate");
  return payload as MatchFoundPayload;
}

export async function startRecording(sessionId: string) {
  const res = await fetch(`${SIGNALING_URL}/debates/${sessionId}/recording/start`, {
    method: "POST",
  });
  const payload = await res.json();
  if (!res.ok) throw new Error(payload.error || "Failed to start recording");
  return payload.recording;
}

export async function stopRecording(sessionId: string) {
  const res = await fetch(`${SIGNALING_URL}/debates/${sessionId}/recording/stop`, {
    method: "POST",
  });
  const payload = await res.json();
  if (!res.ok) throw new Error(payload.error || "Failed to stop recording");
  return payload.recording;
}

export async function startStreaming(input: {
  sessionId: string;
  platform: string;
  rtmpUrl: string;
  streamKey: string;
}) {
  const res = await fetch(`${SIGNALING_URL}/debates/${input.sessionId}/streaming/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      platform: input.platform,
      rtmpUrl: input.rtmpUrl,
      streamKey: input.streamKey,
    }),
  });
  const payload = await res.json();
  if (!res.ok) throw new Error(payload.detail || payload.error || "Failed to start stream");
  return payload.streaming;
}

export async function stopStreaming(sessionId: string) {
  const res = await fetch(`${SIGNALING_URL}/debates/${sessionId}/streaming/stop`, {
    method: "POST",
  });
  const payload = await res.json();
  if (!res.ok) throw new Error(payload.detail || payload.error || "Failed to stop stream");
  return payload.streaming;
}
