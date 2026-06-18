export type DebateMode = "random" | "pick_topic" | "pick_side";
export type Side = "a" | "b";

export interface Topic {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  created_by?: string | null;
  side_a_label: string;
  side_b_label: string;
}

export interface LiveDebate {
  id: string;
  room_name: string;
  topic_title_snapshot: string | null;
  participant_a_display_name: string | null;
  participant_a_side: Side | null;
  participant_b_display_name: string | null;
  participant_b_side: Side | null;
  started_at: string;
  recording?: {
    status: "idle" | "setup_required" | "recording" | "stopped" | "failed";
    message?: string;
    updatedAt?: string;
  };
  streaming?: {
    status: "idle" | "streaming" | "stopped" | "failed";
    message?: string;
    platform?: string;
    updatedAt?: string;
  };
  moderator?: {
    requested: boolean;
    displayName?: string;
    joinedAt?: string;
  };
}

export interface DebateInvite {
  code: string;
  creatorName: string;
  mode: DebateMode;
  topicId: string | null;
  side: Side | null;
  moderatorRequested: boolean;
  createdAt: string;
}

export interface QueueJoinPayload {
  displayName: string;
  userId: string | null;
  mode: DebateMode;
  topicId: string | null;
  side: Side | null;
}

export interface MatchFoundPayload {
  sessionId: string;
  roomName: string;
  livekitUrl: string;
  token: string;
  audience?: boolean;
  moderator?: boolean;
  yourSide: Side | null;
  topic: {
    id: string;
    title: string;
    sideALabel: string;
    sideBLabel: string;
  } | null;
  opponent: {
    displayName: string;
    side: Side | null;
  };
}

export interface ChatMessage {
  id: string;
  session_id: string;
  sender_display_name: string;
  sender_user_id: string | null;
  body: string;
  contains_link: boolean;
  created_at: string;
}
