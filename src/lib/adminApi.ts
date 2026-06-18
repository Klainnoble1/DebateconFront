const SIGNALING_URL =
  process.env.NEXT_PUBLIC_SIGNALING_URL || "http://localhost:4000";

function adminHeaders(token: string) {
  return {
    "Content-Type": "application/json",
    "x-admin-token": token,
  };
}

async function adminFetch<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${SIGNALING_URL}${path}`, {
    ...init,
    headers: {
      ...adminHeaders(token),
      ...(init?.headers || {}),
    },
  });
  const payload = await res.json();
  if (!res.ok) throw new Error(payload.error || "Admin request failed");
  return payload as T;
}

export function loadAdminOverview(token: string) {
  return adminFetch<{ metrics: Record<string, number> }>("/admin/overview", token);
}

export function loadAdminUsers(token: string) {
  return adminFetch<{ users: AdminUser[] }>("/admin/users", token);
}

export function loadAdminDebates(token: string) {
  return adminFetch<{ debates: AdminDebate[] }>("/admin/debates", token);
}

export function loadModeratorApplications(token: string) {
  return adminFetch<{ applications: ModeratorApplication[] }>(
    "/admin/moderator-applications",
    token
  );
}

export function decideModeratorApplication(
  token: string,
  applicationId: string,
  decision: "approve" | "reject"
) {
  return adminFetch<{ application: ModeratorApplication }>(
    `/admin/moderator-applications/${applicationId}/${decision}`,
    token,
    { method: "POST" }
  );
}

export function createManualJoinLink(
  token: string,
  sessionId: string,
  input: { displayName: string; role: string }
) {
  return adminFetch<{ joinUrl: string }>(`/admin/debates/${sessionId}/manual-join`, token, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface AdminUser {
  id: string;
  email?: string;
  created_at?: string;
  last_sign_in_at?: string;
  confirmed_at?: string;
}

export interface AdminDebate {
  id: string;
  room_name: string;
  topic_title_snapshot: string | null;
  participant_a_display_name: string | null;
  participant_b_display_name: string | null;
  started_at: string;
  ended_at: string | null;
  ended_reason: string | null;
}

export interface ModeratorApplication {
  id: string;
  user_id?: string;
  email?: string;
  reason: string;
  experience?: string | null;
  contact?: string | null;
  status: "pending" | "approved" | "rejected";
  created_at?: string;
  reviewed_at?: string | null;
}
