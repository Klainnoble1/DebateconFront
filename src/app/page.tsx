"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { getGuestIdentity } from "@/lib/socket";
import {
  createDebateInvite,
  createListenerMatch,
  createModeratorMatch,
  createMotion,
  loadLiveDebates,
  loadTopics,
  submitModeratorApplication,
} from "@/lib/signalingApi";
import type { LiveDebate, Topic, DebateMode, Side } from "@/lib/types";

export default function HomePage() {
  const router = useRouter();
  const [mode, setMode] = useState<DebateMode>("random");
  const [topics, setTopics] = useState<Topic[]>([]);
  const [liveDebates, setLiveDebates] = useState<LiveDebate[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<string>("");
  const [selectedSide, setSelectedSide] = useState<Side>("a");
  const [moderatorRequested, setModeratorRequested] = useState(false);
  const [displayName, setDisplayName] = useState(() => getGuestIdentity().displayName);
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [motionTitle, setMotionTitle] = useState("");
  const [motionDescription, setMotionDescription] = useState("");
  const [sideALabel, setSideALabel] = useState("For");
  const [sideBLabel, setSideBLabel] = useState("Against");
  const [motionMessage, setMotionMessage] = useState("");
  const [listenError, setListenError] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [moderatorReason, setModeratorReason] = useState("");
  const [moderatorExperience, setModeratorExperience] = useState("");
  const [moderatorContact, setModeratorContact] = useState("");
  const [moderatorApplicationMessage, setModeratorApplicationMessage] = useState("");

  useEffect(() => {
    refreshTopics();
    refreshLiveDebates();
    const liveTimer = setInterval(refreshLiveDebates, 5000);

    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => {
      clearInterval(liveTimer);
      authSub.subscription.unsubscribe();
    };
  }, []);

  async function refreshTopics() {
    try {
      const nextTopics = await loadTopics();
      setTopics(nextTopics);
      if (nextTopics.length > 0) {
        setSelectedTopicId((current) => current || nextTopics[0].id);
      }
    } catch {
      setTopics([]);
    }
  }

  async function refreshLiveDebates() {
    try {
      setLiveDebates(await loadLiveDebates());
    } catch {
      setLiveDebates([]);
    }
  }

  const selectedTopic = topics.find((t) => t.id === selectedTopicId);

  function handleEnterQueue() {
    const params = new URLSearchParams();
    params.set("mode", mode);
    params.set("name", displayName);
    if (mode !== "random") params.set("topicId", selectedTopicId);
    if (mode === "pick_side") params.set("side", selectedSide);
    if (moderatorRequested) params.set("moderator", "1");
    router.push(`/queue?${params.toString()}`);
  }

  async function handleSignIn() {
    setAuthMessage("");
    const trimmed = email.trim();
    if (!trimmed) return;
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: window.location.origin },
    });
    setAuthMessage(error ? error.message : "Check your email for the sign-in link.");
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setAuthMessage("");
  }

  async function handleCreateMotion() {
    setMotionMessage("");
    try {
      const topic = await createMotion({
        title: motionTitle,
        description: motionDescription,
        sideALabel,
        sideBLabel,
      });
      setTopics((current) => [topic, ...current]);
      setSelectedTopicId(topic.id);
      setMode("pick_topic");
      setMotionTitle("");
      setMotionDescription("");
      setMotionMessage("Motion created.");
    } catch (err) {
      setMotionMessage(err instanceof Error ? err.message : "Failed to create motion");
    }
  }

  async function handleListen(debate: LiveDebate) {
    setListenError("");
    try {
      const match = await createListenerMatch(debate.id, displayName || "Listener");
      sessionStorage.setItem("lectern_match", JSON.stringify(match));
      router.push(`/debate/${match.roomName}`);
    } catch (err) {
      setListenError(err instanceof Error ? err.message : "Failed to join debate");
    }
  }

  async function handleModerate(debate: LiveDebate) {
    setListenError("");
    try {
      const match = await createModeratorMatch(debate.id, displayName || "Moderator");
      sessionStorage.setItem("lectern_match", JSON.stringify(match));
      router.push(`/debate/${match.roomName}`);
    } catch (err) {
      setListenError(err instanceof Error ? err.message : "Failed to moderate debate");
    }
  }

  async function handleCreateInvite() {
    setInviteMessage("");
    setInviteUrl("");
    try {
      const { inviteUrl: nextInviteUrl } = await createDebateInvite({
        creatorName: displayName || "Guest",
        mode,
        topicId: mode === "random" ? null : selectedTopicId,
        side: mode === "pick_side" ? selectedSide : null,
        moderatorRequested,
      });
      setInviteUrl(nextInviteUrl);
      setInviteMessage("Invite link created.");
    } catch (err) {
      setInviteMessage(err instanceof Error ? err.message : "Failed to create invite");
    }
  }

  async function handleApplyToModerate() {
    setModeratorApplicationMessage("");
    try {
      await submitModeratorApplication({
        reason: moderatorReason,
        experience: moderatorExperience,
        contact: moderatorContact,
      });
      setModeratorReason("");
      setModeratorExperience("");
      setModeratorContact("");
      setModeratorApplicationMessage("Application submitted.");
    } catch (err) {
      setModeratorApplicationMessage(
        err instanceof Error ? err.message : "Failed to submit application"
      );
    }
  }

  return (
    <main className="flex-1 paper-texture">
      <div className="max-w-6xl mx-auto px-6 py-12 sm:py-16">
        <header className="mb-10 text-center">
          <p className="font-mono text-xs tracking-[0.2em] uppercase text-ink-soft mb-3">
            A live video debate chamber
          </p>
          <h1 className="font-display text-6xl sm:text-7xl italic tracking-tight text-ink">
            Debate Con
          </h1>
          <div className="mt-4 flex items-center justify-center gap-3">
            <span className="h-px w-12 bg-line" />
            <p className="font-mono text-[11px] tracking-[0.15em] uppercase text-ink-soft">
              Create motions. Watch live. Make your case.
            </p>
            <span className="h-px w-12 bg-line" />
          </div>
        </header>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
          <section className="border border-line bg-paper-dim/40 rounded-sm p-6 sm:p-8">
            <label className="block font-mono text-[11px] uppercase tracking-[0.15em] text-ink-soft mb-4">
              Your name for this debate
            </label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={24}
              className="w-full bg-paper border border-line rounded-sm px-4 py-3 font-body text-ink mb-8 focus:border-ink transition-colors"
              placeholder="Guest1234"
            />

            <label className="block font-mono text-[11px] uppercase tracking-[0.15em] text-ink-soft mb-4">
              How do you want to be matched?
            </label>

            <div className="grid sm:grid-cols-3 gap-3 mb-8">
              <ModeCard
                active={mode === "random"}
                title="Surprise me"
                description="Random motion, random opponent."
                onClick={() => setMode("random")}
              />
              <ModeCard
                active={mode === "pick_topic"}
                title="Pick a motion"
                description="Choose the topic, take either side."
                onClick={() => setMode("pick_topic")}
              />
              <ModeCard
                active={mode === "pick_side"}
                title="Pick a side"
                description="Choose topic and stance."
                onClick={() => setMode("pick_side")}
              />
            </div>

            {mode !== "random" && (
              <div className="mb-8">
                <label className="block font-mono text-[11px] uppercase tracking-[0.15em] text-ink-soft mb-4">
                  The motion
                </label>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {topics.map((topic) => (
                    <button
                      key={topic.id}
                      onClick={() => setSelectedTopicId(topic.id)}
                      className={`w-full text-left px-4 py-3 rounded-sm border transition-colors font-display text-lg ${
                        selectedTopicId === topic.id
                          ? "border-ink bg-ink text-paper"
                          : "border-line hover:border-ink-soft"
                      }`}
                    >
                      {topic.title}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mode === "pick_side" && selectedTopic && (
              <div className="mb-8">
                <label className="block font-mono text-[11px] uppercase tracking-[0.15em] text-ink-soft mb-4">
                  Your stance
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <SideButton
                    active={selectedSide === "a"}
                    label={selectedTopic.side_a_label}
                    side="a"
                    onClick={() => setSelectedSide("a")}
                  />
                  <SideButton
                    active={selectedSide === "b"}
                    label={selectedTopic.side_b_label}
                    side="b"
                    onClick={() => setSelectedSide("b")}
                  />
                </div>
              </div>
            )}

            <label className="mb-8 flex items-start gap-3 border border-line rounded-sm bg-paper/70 p-4">
              <input
                type="checkbox"
                checked={moderatorRequested}
                onChange={(e) => setModeratorRequested(e.target.checked)}
                className="mt-1 h-4 w-4 accent-ink"
              />
              <span>
                <span className="block font-display text-lg italic text-ink">
                  Request a moderator
                </span>
                <span className="block font-body text-sm text-ink-soft">
                  Optional. The debate still starts when two speakers match.
                </span>
              </span>
            </label>

            <button
              onClick={handleEnterQueue}
              disabled={!displayName.trim() || (mode !== "random" && !selectedTopicId)}
              className="w-full bg-ink text-paper font-display text-xl italic py-4 rounded-sm hover:bg-side-a transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Enter the chamber
            </button>

            <div className="mt-4 grid sm:grid-cols-[1fr_auto] gap-3">
              <button
                onClick={handleCreateInvite}
                disabled={!displayName.trim() || (mode !== "random" && !selectedTopicId)}
                className="border border-ink text-ink font-mono text-xs uppercase tracking-wide py-3 rounded-sm hover:bg-ink hover:text-paper transition-colors disabled:opacity-40"
              >
                Create invite link
              </button>
              {inviteUrl && (
                <button
                  onClick={() => router.push(`/queue?invite=${encodeURIComponent(inviteUrl.split("invite=")[1] || "")}&name=${encodeURIComponent(displayName || "Guest")}`)}
                  className="bg-side-b text-paper font-mono text-xs uppercase tracking-wide px-4 py-3 rounded-sm"
                >
                  Wait for invitee
                </button>
              )}
            </div>
            {inviteUrl && (
              <input
                readOnly
                value={inviteUrl}
                className="mt-3 w-full bg-paper border border-line rounded-sm px-3 py-2 text-sm font-mono text-ink-soft"
                onFocus={(e) => e.currentTarget.select()}
              />
            )}
            {inviteMessage && (
              <p className="mt-2 font-body text-sm text-ink-soft">{inviteMessage}</p>
            )}
          </section>

          <aside className="space-y-6">
            <section className="border border-line bg-paper rounded-sm p-5">
              <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink-soft mb-3">
                Signed-in motions
              </p>
              {user ? (
                <div className="space-y-3">
                  <p className="font-body text-sm text-ink-soft break-all">{user.email}</p>
                  <input
                    value={motionTitle}
                    onChange={(e) => setMotionTitle(e.target.value)}
                    className="w-full bg-paper-dim border border-line rounded-sm px-3 py-2 text-sm"
                    placeholder="Motion title"
                  />
                  <textarea
                    value={motionDescription}
                    onChange={(e) => setMotionDescription(e.target.value)}
                    className="w-full bg-paper-dim border border-line rounded-sm px-3 py-2 text-sm min-h-20"
                    placeholder="Short context"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={sideALabel}
                      onChange={(e) => setSideALabel(e.target.value)}
                      className="bg-paper-dim border border-line rounded-sm px-3 py-2 text-sm"
                      placeholder="For"
                    />
                    <input
                      value={sideBLabel}
                      onChange={(e) => setSideBLabel(e.target.value)}
                      className="bg-paper-dim border border-line rounded-sm px-3 py-2 text-sm"
                      placeholder="Against"
                    />
                  </div>
                  <button
                    onClick={handleCreateMotion}
                    disabled={motionTitle.trim().length < 8}
                    className="w-full bg-ink text-paper font-mono text-xs uppercase tracking-wide py-3 rounded-sm disabled:opacity-40"
                  >
                    Create motion
                  </button>
                  {motionMessage && (
                    <p className="font-body text-sm text-ink-soft">{motionMessage}</p>
                  )}
                  <button
                    onClick={handleSignOut}
                    className="font-mono text-[11px] uppercase tracking-wide text-ink-soft hover:text-side-a"
                  >
                    Sign out
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    className="w-full bg-paper-dim border border-line rounded-sm px-3 py-2 text-sm"
                    placeholder="email@example.com"
                  />
                  <button
                    onClick={handleSignIn}
                    className="w-full border border-ink text-ink font-mono text-xs uppercase tracking-wide py-3 rounded-sm hover:bg-ink hover:text-paper transition-colors"
                  >
                    Send sign-in link
                  </button>
                  {authMessage && (
                    <p className="font-body text-sm text-ink-soft">{authMessage}</p>
                  )}
                </div>
              )}
            </section>

            <section className="border border-line bg-paper rounded-sm p-5">
              <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink-soft mb-3">
                Apply to moderate
              </p>
              {user ? (
                <div className="space-y-3">
                  <textarea
                    value={moderatorReason}
                    onChange={(e) => setModeratorReason(e.target.value)}
                    className="w-full bg-paper-dim border border-line rounded-sm px-3 py-2 text-sm min-h-24"
                    placeholder="Why do you want to moderate debates?"
                  />
                  <textarea
                    value={moderatorExperience}
                    onChange={(e) => setModeratorExperience(e.target.value)}
                    className="w-full bg-paper-dim border border-line rounded-sm px-3 py-2 text-sm min-h-20"
                    placeholder="Relevant experience"
                  />
                  <input
                    value={moderatorContact}
                    onChange={(e) => setModeratorContact(e.target.value)}
                    className="w-full bg-paper-dim border border-line rounded-sm px-3 py-2 text-sm"
                    placeholder="Contact handle or notes"
                  />
                  <button
                    onClick={handleApplyToModerate}
                    disabled={moderatorReason.trim().length < 20}
                    className="w-full border border-accent-gold text-accent-gold font-mono text-xs uppercase tracking-wide py-3 rounded-sm disabled:opacity-40"
                  >
                    Submit application
                  </button>
                  {moderatorApplicationMessage && (
                    <p className="font-body text-sm text-ink-soft">
                      {moderatorApplicationMessage}
                    </p>
                  )}
                </div>
              ) : (
                <p className="font-body text-sm text-ink-soft">
                  Sign in with email above to apply as a moderator.
                </p>
              )}
            </section>

            <section className="border border-line bg-paper rounded-sm p-5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink-soft">
                  Live debates
                </p>
                <button
                  onClick={refreshLiveDebates}
                  className="font-mono text-[10px] uppercase tracking-wide text-ink-soft hover:text-ink"
                >
                  Refresh
                </button>
              </div>
              <div className="space-y-3">
                {liveDebates.length === 0 && (
                  <p className="font-body text-sm text-ink-soft italic">
                    No debates are live right now.
                  </p>
                )}
                {liveDebates.map((debate) => (
                  <div key={debate.id} className="border border-line rounded-sm p-3">
                    <p className="font-display text-lg italic leading-tight mb-2">
                      {debate.topic_title_snapshot || "Open debate"}
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-wide text-ink-soft mb-3">
                      {debate.participant_a_display_name || "Speaker A"} vs{" "}
                      {debate.participant_b_display_name || "Speaker B"}
                    </p>
                    {debate.moderator?.requested && (
                      <p className="font-mono text-[10px] uppercase tracking-wide text-accent-gold mb-3">
                        Moderator requested
                      </p>
                    )}
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-[10px] uppercase tracking-wide text-side-a">
                        Live
                      </span>
                      <div className="flex items-center gap-2">
                        {debate.moderator?.requested && (
                          <button
                            onClick={() => handleModerate(debate)}
                            className="font-mono text-[11px] uppercase tracking-wide border border-accent-gold text-accent-gold px-3 py-2 rounded-sm"
                          >
                            Moderate
                          </button>
                        )}
                        <button
                          onClick={() => handleListen(debate)}
                          className="font-mono text-[11px] uppercase tracking-wide bg-ink text-paper px-3 py-2 rounded-sm"
                        >
                          Listen
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {listenError && <p className="mt-3 font-body text-sm text-side-a">{listenError}</p>}
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

function ModeCard({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left p-4 rounded-sm border transition-colors ${
        active ? "border-ink bg-ink text-paper" : "border-line hover:border-ink-soft"
      }`}
    >
      <p className="font-display text-lg italic mb-1">{title}</p>
      <p className={`font-body text-sm ${active ? "text-paper/70" : "text-ink-soft"}`}>
        {description}
      </p>
    </button>
  );
}

function SideButton({
  active,
  label,
  side,
  onClick,
}: {
  active: boolean;
  label: string;
  side: Side;
  onClick: () => void;
}) {
  const activeClass =
    side === "a" ? "border-side-a bg-side-a-dim text-side-a" : "border-side-b bg-side-b-dim text-side-b";
  const idleClass = side === "a" ? "hover:border-side-a" : "hover:border-side-b";

  return (
    <button
      onClick={onClick}
      className={`px-4 py-4 rounded-sm border-2 font-display text-lg transition-colors ${
        active ? activeClass : `border-line text-ink-soft ${idleClass}`
      }`}
    >
      {label}
    </button>
  );
}
