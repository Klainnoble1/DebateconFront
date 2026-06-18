-- =========================================================
-- Debate App — Supabase Schema
-- =========================================================
-- Run this in the Supabase SQL editor.
-- Accounts are OPTIONAL: anonymous users get a generated
-- session id (stored client-side), registered users link
-- to auth.users via user_id.
-- =========================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------
-- profiles: extends Supabase auth.users for registered users
-- ---------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  role text default 'user' check (role in ('user', 'moderator', 'admin')),
  total_debates int default 0,
  wins int default 0,        -- self-reported / audience-voted, optional
  created_at timestamptz default now()
);

-- ---------------------------------------------------------
-- topics: curated debate topics (for "pick a topic" mode)
-- ---------------------------------------------------------
create table if not exists topics (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text,                  -- e.g. 'politics', 'tech', 'philosophy'
  created_by uuid references auth.users(id),
  side_a_label text default 'For',
  side_b_label text default 'Against',
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Patch: add created_by column if the table already existed without it
alter table topics add column if not exists created_by uuid references auth.users(id);

-- seed a few starter topics
insert into topics (title, category, side_a_label, side_b_label) values
  ('AI will create more jobs than it destroys', 'tech', 'Agree', 'Disagree'),
  ('Social media does more harm than good', 'society', 'Agree', 'Disagree'),
  ('Remote work is better than office work', 'work', 'For', 'Against'),
  ('Cryptocurrency is the future of money', 'finance', 'For', 'Against'),
  ('College degrees are still worth it', 'education', 'Agree', 'Disagree')
on conflict do nothing;

-- ---------------------------------------------------------
-- queue: live matchmaking queue (short-lived rows)
-- ---------------------------------------------------------
-- Note: for high concurrency, consider moving this to Redis.
-- Supabase Postgres is fine for moderate traffic + simplicity.
create table if not exists matchmaking_queue (
  id uuid primary key default gen_random_uuid(),
  socket_id text not null unique,
  user_id uuid references profiles(id),       -- null if anonymous
  display_name text not null,                 -- "Guest1234" or username
  mode text not null check (mode in ('random', 'pick_topic', 'pick_side')),
  topic_id uuid references topics(id),         -- set for pick_topic / pick_side
  side text check (side in ('a', 'b')),         -- set for pick_side
  moderator_requested boolean default false,
  status text not null default 'waiting' check (status in ('waiting', 'matched', 'cancelled')),
  created_at timestamptz default now()
);

create index if not exists idx_queue_status_mode on matchmaking_queue (status, mode, topic_id);

-- ---------------------------------------------------------
-- debate_invites: optional private invite links
-- ---------------------------------------------------------
create table if not exists debate_invites (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  creator_user_id uuid references auth.users(id),
  creator_display_name text,
  mode text not null default 'random' check (mode in ('random', 'pick_topic', 'pick_side')),
  topic_id uuid references topics(id),
  side text check (side in ('a', 'b')),
  moderator_requested boolean default false,
  accepted_at timestamptz,
  expires_at timestamptz default (now() + interval '24 hours'),
  created_at timestamptz default now()
);

-- ---------------------------------------------------------
-- moderator_applications: people applying to be trusted moderators
-- ---------------------------------------------------------
create table if not exists moderator_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  email text,
  reason text not null,
  experience text,
  contact text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_at timestamptz,
  created_at timestamptz default now()
);

-- ---------------------------------------------------------
-- debate_sessions: a matched pair + their LiveKit room
-- ---------------------------------------------------------
create table if not exists debate_sessions (
  id uuid primary key default gen_random_uuid(),
  room_name text not null unique,              -- LiveKit room name
  topic_id uuid references topics(id),
  topic_title_snapshot text,                   -- denormalized in case topic is custom/deleted later
  participant_a_user_id uuid references profiles(id),
  participant_a_display_name text,
  participant_a_side text check (participant_a_side in ('a','b')),
  participant_b_user_id uuid references profiles(id),
  participant_b_display_name text,
  participant_b_side text check (participant_b_side in ('a','b')),
  moderator_requested boolean default false,
  moderator_display_name text,
  recording_status text default 'idle' check (recording_status in ('idle', 'setup_required', 'recording', 'stopped', 'failed')),
  recording_egress_id text,
  recording_url text,
  streaming_status text default 'idle' check (streaming_status in ('idle', 'streaming', 'stopped', 'failed')),
  streaming_egress_id text,
  streaming_platform text,
  started_at timestamptz default now(),
  ended_at timestamptz,
  ended_reason text                            -- 'completed', 'left_early', 'error'
);

-- ---------------------------------------------------------
-- session_messages: chat log per session (links, text)
-- ---------------------------------------------------------
create table if not exists session_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references debate_sessions(id) on delete cascade,
  sender_display_name text not null,
  sender_user_id uuid references profiles(id),
  body text not null,
  contains_link boolean default false,
  created_at timestamptz default now()
);

create index if not exists idx_session_messages_session on session_messages (session_id, created_at);

-- ---------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------
alter table profiles enable row level security;
alter table matchmaking_queue enable row level security;
alter table debate_sessions enable row level security;
alter table session_messages enable row level security;
alter table topics enable row level security;

-- ---------------------------------------------------------
-- Row Level Security Policies (idempotent — safe to re-run)
-- ---------------------------------------------------------

-- Topics
drop policy if exists "topics_select_all" on topics;
drop policy if exists "topics_insert_signed_in" on topics;
create policy "topics_select_all" on topics for select using (true);
create policy "topics_insert_signed_in" on topics
  for insert
  with check (auth.uid() is not null and auth.uid() = created_by);

-- Profiles: users can read all (for display names/stats), only update their own
drop policy if exists "profiles_select_all" on profiles;
drop policy if exists "profiles_update_own" on profiles;
drop policy if exists "profiles_insert_own" on profiles;
create policy "profiles_select_all" on profiles for select using (true);
create policy "profiles_update_own" on profiles for update using (auth.uid() = id);
create policy "profiles_insert_own" on profiles for insert with check (auth.uid() = id);

-- Queue / sessions / messages: writes should go through the signaling
-- server using the Supabase SERVICE ROLE key (bypasses RLS), since the
-- server is the trusted broker for matchmaking. Block direct client writes.
drop policy if exists "queue_no_client_write" on matchmaking_queue;
drop policy if exists "sessions_no_client_write" on debate_sessions;
drop policy if exists "messages_select_own_session" on session_messages;
drop policy if exists "messages_no_client_write" on session_messages;
create policy "queue_no_client_write" on matchmaking_queue for all using (false);
create policy "sessions_no_client_write" on debate_sessions for all using (false);
create policy "messages_select_own_session" on session_messages for select using (true);
create policy "messages_no_client_write" on session_messages for insert with check (false);

