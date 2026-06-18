"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createManualJoinLink,
  decideModeratorApplication,
  loadAdminDebates,
  loadAdminOverview,
  loadAdminUsers,
  loadModeratorApplications,
  type AdminDebate,
  type AdminUser,
  type ModeratorApplication,
} from "@/lib/adminApi";

type Tab = "overview" | "users" | "debates" | "moderators";

export default function AdminPage() {
  const [token, setToken] = useState(() =>
    typeof window === "undefined" ? "" : sessionStorage.getItem("debatecon_admin_token") || ""
  );
  const [savedToken, setSavedToken] = useState(() =>
    typeof window === "undefined" ? "" : sessionStorage.getItem("debatecon_admin_token") || ""
  );
  const [tab, setTab] = useState<Tab>("overview");
  const [metrics, setMetrics] = useState<Record<string, number>>({});
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [debates, setDebates] = useState<AdminDebate[]>([]);
  const [applications, setApplications] = useState<ModeratorApplication[]>([]);
  const [error, setError] = useState("");
  const [manualSessionId, setManualSessionId] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualRole, setManualRole] = useState("listener");
  const [manualJoinUrl, setManualJoinUrl] = useState("");

  const liveDebates = useMemo(
    () => debates.filter((debate) => !debate.ended_at),
    [debates]
  );

  const refresh = useCallback(async (nextToken = savedToken) => {
    if (!nextToken) return;
    setError("");
    try {
      const [overviewRes, usersRes, debatesRes, applicationsRes] = await Promise.all([
        loadAdminOverview(nextToken),
        loadAdminUsers(nextToken),
        loadAdminDebates(nextToken),
        loadModeratorApplications(nextToken),
      ]);
      setMetrics(overviewRes.metrics);
      setUsers(usersRes.users);
      setDebates(debatesRes.debates);
      setApplications(applicationsRes.applications);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load admin data");
    }
  }, [savedToken]);

  useEffect(() => {
    if (savedToken) {
      queueMicrotask(() => {
        refresh(savedToken);
      });
    }
  }, [refresh, savedToken]);

  function handleUnlock() {
    sessionStorage.setItem("debatecon_admin_token", token);
    setSavedToken(token);
    refresh(token);
  }

  async function handleDecision(applicationId: string, decision: "approve" | "reject") {
    setError("");
    try {
      await decideModeratorApplication(savedToken, applicationId, decision);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update application");
    }
  }

  async function handleManualJoin() {
    setError("");
    setManualJoinUrl("");
    try {
      const res = await createManualJoinLink(savedToken, manualSessionId, {
        displayName: manualName || "Manual participant",
        role: manualRole,
      });
      setManualJoinUrl(res.joinUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create join link");
    }
  }

  return (
    <main className="min-h-screen bg-paper paper-texture text-ink">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-8">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft mb-2">
              Debate Con operations
            </p>
            <h1 className="font-display text-4xl italic">Admin Portal</h1>
          </div>
          <button
            onClick={() => refresh()}
            className="font-mono text-xs uppercase tracking-wide border border-ink px-4 py-2 rounded-sm hover:bg-ink hover:text-paper transition-colors"
          >
            Refresh
          </button>
        </header>

        {!savedToken && (
          <section className="border border-line bg-paper rounded-sm p-5 max-w-xl mb-8">
            <label className="block font-mono text-[11px] uppercase tracking-wide text-ink-soft mb-3">
              Admin token
            </label>
            <div className="flex gap-2">
              <input
                value={token}
                onChange={(e) => setToken(e.target.value)}
                type="password"
                className="flex-1 bg-paper-dim border border-line rounded-sm px-3 py-2"
                placeholder="Enter admin token"
              />
              <button
                onClick={handleUnlock}
                className="bg-ink text-paper font-mono text-xs uppercase tracking-wide px-4 rounded-sm"
              >
                Unlock
              </button>
            </div>
          </section>
        )}

        {error && (
          <p className="mb-4 border border-side-a bg-side-a-dim text-side-a rounded-sm px-4 py-3 text-sm">
            {error}
          </p>
        )}

        {savedToken && (
          <>
            <nav className="flex flex-wrap gap-2 mb-6">
              {(["overview", "users", "debates", "moderators"] as Tab[]).map((item) => (
                <button
                  key={item}
                  onClick={() => setTab(item)}
                  className={`font-mono text-xs uppercase tracking-wide px-4 py-2 rounded-sm border ${
                    tab === item ? "bg-ink text-paper border-ink" : "border-line text-ink-soft"
                  }`}
                >
                  {item}
                </button>
              ))}
            </nav>

            {tab === "overview" && (
              <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(metrics).map(([key, value]) => (
                  <div key={key} className="border border-line bg-paper rounded-sm p-5">
                    <p className="font-mono text-[10px] uppercase tracking-wide text-ink-soft mb-2">
                      {key.replace(/([A-Z])/g, " $1")}
                    </p>
                    <p className="font-display text-4xl italic">{value}</p>
                  </div>
                ))}
              </section>
            )}

            {tab === "users" && (
              <section className="border border-line bg-paper rounded-sm overflow-hidden">
                <Table
                  headers={["Email", "Created", "Last sign-in", "Confirmed"]}
                  rows={users.map((user) => [
                    user.email || user.id,
                    formatDate(user.created_at),
                    formatDate(user.last_sign_in_at),
                    formatDate(user.confirmed_at),
                  ])}
                />
              </section>
            )}

            {tab === "debates" && (
              <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-6">
                <section className="border border-line bg-paper rounded-sm overflow-hidden">
                  <Table
                    headers={["Motion", "Speakers", "Started", "Status"]}
                    rows={debates.map((debate) => [
                      debate.topic_title_snapshot || "Open debate",
                      `${debate.participant_a_display_name || "A"} vs ${debate.participant_b_display_name || "B"}`,
                      formatDate(debate.started_at),
                      debate.ended_at ? `Ended ${debate.ended_reason || ""}` : "Live",
                    ])}
                  />
                </section>

                <section className="border border-line bg-paper rounded-sm p-5">
                  <p className="font-mono text-[11px] uppercase tracking-wide text-ink-soft mb-4">
                    Manually add person
                  </p>
                  <div className="space-y-3">
                    <select
                      value={manualSessionId}
                      onChange={(e) => setManualSessionId(e.target.value)}
                      className="w-full bg-paper-dim border border-line rounded-sm px-3 py-2 text-sm"
                    >
                      <option value="">Choose live debate</option>
                      {liveDebates.map((debate) => (
                        <option key={debate.id} value={debate.id}>
                          {debate.topic_title_snapshot || debate.room_name}
                        </option>
                      ))}
                    </select>
                    <input
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      className="w-full bg-paper-dim border border-line rounded-sm px-3 py-2 text-sm"
                      placeholder="Display name"
                    />
                    <select
                      value={manualRole}
                      onChange={(e) => setManualRole(e.target.value)}
                      className="w-full bg-paper-dim border border-line rounded-sm px-3 py-2 text-sm"
                    >
                      <option value="listener">Listener</option>
                      <option value="moderator">Moderator</option>
                      <option value="speaker_a">Speaker A</option>
                      <option value="speaker_b">Speaker B</option>
                    </select>
                    <button
                      onClick={handleManualJoin}
                      disabled={!manualSessionId}
                      className="w-full bg-ink text-paper font-mono text-xs uppercase tracking-wide py-3 rounded-sm disabled:opacity-40"
                    >
                      Generate join link
                    </button>
                    {manualJoinUrl && (
                      <input
                        readOnly
                        value={manualJoinUrl}
                        onFocus={(e) => e.currentTarget.select()}
                        className="w-full bg-paper-dim border border-line rounded-sm px-3 py-2 text-xs font-mono"
                      />
                    )}
                  </div>
                </section>
              </div>
            )}

            {tab === "moderators" && (
              <section className="space-y-3">
                {applications.length === 0 && (
                  <p className="border border-line bg-paper rounded-sm p-5 text-sm text-ink-soft">
                    No moderator applications yet.
                  </p>
                )}
                {applications.map((application) => (
                  <div key={application.id} className="border border-line bg-paper rounded-sm p-5">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-wide text-ink-soft mb-2">
                          {application.email || application.user_id || "Applicant"} | {application.status}
                        </p>
                        <p className="font-body text-sm mb-3">{application.reason}</p>
                        {application.experience && (
                          <p className="font-body text-sm text-ink-soft mb-2">
                            {application.experience}
                          </p>
                        )}
                        {application.contact && (
                          <p className="font-mono text-[11px] text-ink-soft">
                            {application.contact}
                          </p>
                        )}
                      </div>
                      {application.status === "pending" && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleDecision(application.id, "approve")}
                            className="bg-ink text-paper font-mono text-xs uppercase tracking-wide px-3 py-2 rounded-sm"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleDecision(application.id, "reject")}
                            className="border border-side-a text-side-a font-mono text-xs uppercase tracking-wide px-3 py-2 rounded-sm"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-paper-dim">
          <tr>
            {headers.map((header) => (
              <th
                key={header}
                className="text-left font-mono text-[10px] uppercase tracking-wide text-ink-soft px-4 py-3"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-t border-line">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-4 py-3 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}
