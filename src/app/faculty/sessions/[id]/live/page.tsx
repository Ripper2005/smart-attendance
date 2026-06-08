"use client";

/**
 * /faculty/sessions/[id]/live
 * The core real-time session control page for faculty.
 *
 * LEFT:  Auto-refreshing QR code (every 5s), countdown timer, Live badge
 * RIGHT: Real-time attendance roster (polls every 10s), lock status indicators,
 *        inline faculty override panel per student
 */

import { useEffect, useState, useCallback, FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface SessionInfo {
  id: string;
  courseCode: string;
  courseName: string;
  classroomName: string;
  classroomBuilding: string | null;
  status: string;
  startedAt: string | null;
  endedAt: string | null;
  scheduledEndAt: string | null;
}

interface RosterEntry {
  studentId: string;
  studentName: string;
  studentRegNumber: string | null;
  status: string;
  verifiedAt: string | null;
  lock1TokenVerified: boolean;
  lock2GpsPassed: boolean;
  lock2WifiPassed: boolean;
  lock3BiometricVerified: boolean;
  distanceMeters: number | null;
  clientIpAddress: string | null;
  overrideReason: string | null;
}

function LockIcon({ pass, label }: { pass: boolean; label: string }) {
  return (
    <span
      title={label}
      style={{
        fontSize: "0.8rem",
        padding: "2px 6px",
        borderRadius: 6,
        background: pass ? "rgba(16,185,129,0.15)" : "rgba(107,114,128,0.15)",
        color: pass ? "#10B981" : "var(--color-text-muted)",
        fontWeight: 600,
        letterSpacing: "0.01em",
      }}
    >
      {pass ? "✓" : "○"} {label}
    </span>
  );
}

function statusBadgeClass(status: string) {
  if (status === "PRESENT")  return "badge badge-present";
  if (status === "ABSENT")   return "badge badge-absent";
  if (status === "EXCUSED")  return "badge badge-override";
  if (status === "LATE")     return "badge badge-late";
  return "badge badge-override";
}

export default function LiveSessionPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();

  const [session, setSession]       = useState<SessionInfo | null>(null);
  const [roster, setRoster]         = useState<RosterEntry[]>([]);
  const [totalStudents, setTotal]   = useState(0);
  const [presentCount, setPresent]  = useState(0);
  const [loading, setLoading]       = useState(true);
  const [qrSrc, setQrSrc]          = useState(`/api/faculty/sessions/${id}/qr?t=0`);
  const [countdown, setCountdown]   = useState(5);
  const [stopping, setStopping]     = useState(false);
  const [error, setError]           = useState<string | null>(null);

  // Override panel state
  const [overridingStudentId, setOverridingStudentId] = useState<string | null>(null);
  const [overrideStatus, setOverrideStatus]           = useState<string>("PRESENT");
  const [overrideReason, setOverrideReason]           = useState<string>("");
  const [overrideSubmitting, setOverrideSubmitting]   = useState(false);
  const [overrideError, setOverrideError]             = useState<string | null>(null);

  function getToken() { return localStorage.getItem("access_token") ?? ""; }

  // ── Fetch session + roster ─────────────────────────────
  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/faculty/sessions/${id}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) { setError("Failed to load session."); return; }
    const data = await res.json();
    setSession(data.session);
    setRoster(data.roster ?? []);
    setTotal(data.totalStudents ?? 0);
    setPresent(data.presentCount ?? 0);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── QR auto-refresh every 5s ───────────────────────────
  useEffect(() => {
    setQrSrc(`/api/faculty/sessions/${id}/qr?t=${Date.now()}`);
    const qrInterval = setInterval(() => {
      setQrSrc(`/api/faculty/sessions/${id}/qr?t=${Date.now()}`);
    }, 5000);
    return () => clearInterval(qrInterval);
  }, [id]);

  // ── Countdown timer (updates every 500ms) ─────────────
  useEffect(() => {
    const tickInterval = setInterval(() => {
      const secs = 5 - (Math.floor(Date.now() / 1000) % 5);
      setCountdown(secs);
    }, 500);
    return () => clearInterval(tickInterval);
  }, []);

  // ── Roster polling every 10s ───────────────────────────
  useEffect(() => {
    const pollInterval = setInterval(() => { fetchData(); }, 10000);
    return () => clearInterval(pollInterval);
  }, [fetchData]);

  // ── Stop session ───────────────────────────────────────
  async function handleStop() {
    if (!confirm("Stop this session? Students will no longer be able to mark attendance.")) return;
    setStopping(true);
    const res = await fetch(`/api/faculty/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ action: "stop" }),
    });
    setStopping(false);
    if (res.ok) router.push("/faculty/sessions");
    else setError("Failed to stop session.");
  }

  // ── Override submit ────────────────────────────────────
  async function handleOverrideSubmit(e: FormEvent, studentId: string) {
    e.preventDefault();
    if (overrideReason.trim().length < 3) {
      setOverrideError("Reason must be at least 3 characters.");
      return;
    }
    setOverrideSubmitting(true);
    setOverrideError(null);
    const res = await fetch(`/api/faculty/sessions/${id}/override`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ studentId, status: overrideStatus, reason: overrideReason }),
    });
    const data = await res.json();
    setOverrideSubmitting(false);
    if (!res.ok) {
      setOverrideError(data.error ?? "Override failed.");
      return;
    }
    // Success — close panel and refresh roster
    setOverridingStudentId(null);
    setOverrideReason("");
    setOverrideStatus("PRESENT");
    fetchData();
  }

  function openOverride(studentId: string) {
    setOverridingStudentId(studentId);
    setOverrideStatus("PRESENT");
    setOverrideReason("");
    setOverrideError(null);
  }

  // ── CSV export via fetch + blob (sends auth header) ────
  async function handleExport() {
    try {
      const res = await fetch(`/api/faculty/sessions/${id}/export`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) {
        setError("Failed to export CSV.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `session-${id}-attendance.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Export failed. Please try again.");
    }
  }

  // ── Loading / error states ─────────────────────────────
  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <p style={{ color: "#EF4444", marginBottom: 16 }}>{error}</p>
        <Link href="/faculty/sessions" className="btn btn-secondary" style={{ textDecoration: "none" }}>← Back</Link>
      </div>
    );
  }

  const isActive = session?.status === "ACTIVE";

  return (
    <div style={{ padding: "28px 32px" }}>
      {/* Top Bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
            <Link href="/faculty/sessions" className="text-muted" style={{ fontSize: "0.85rem", textDecoration: "none" }}>← Sessions</Link>
            {isActive && (
              <span className="badge badge-active">
                <span className="pulse-dot" />
                🟢 LIVE
              </span>
            )}
          </div>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
            {session?.courseCode} — {session?.courseName}
          </h1>
          <p className="text-secondary" style={{ fontSize: "0.85rem", marginTop: 4 }}>
            {session?.classroomName}{session?.classroomBuilding ? ` · ${session.classroomBuilding}` : ""}
            {session?.startedAt ? ` · Started ${new Date(session.startedAt).toLocaleTimeString()}` : ""}
            {session?.scheduledEndAt && (
              ` · Ends at ${new Date(session.scheduledEndAt).toLocaleTimeString()} (in ${Math.max(0, Math.ceil((new Date(session.scheduledEndAt).getTime() - Date.now()) / 60000))} min)`
            )}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={handleExport} className="btn btn-secondary btn-sm">
            ⬇ Export CSV
          </button>
          {isActive && (
            <button onClick={handleStop} className="btn btn-danger" disabled={stopping}>
              {stopping ? <span className="spinner" /> : "■ Stop Session"}
            </button>
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}
        className="live-grid"
      >
        {/* LEFT — QR Code Display */}
        <div className="glass" style={{ padding: 28, textAlign: "center" }}>
          <h2 style={{ fontSize: "0.85rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--color-text-muted)", marginBottom: 20 }}>
            Scan to Mark Attendance
          </h2>

          <div className="qr-container" style={{ margin: "0 auto 20px", position: "relative", maxWidth: 300 }}>
            {isActive ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={qrSrc}
                alt="Attendance QR Code"
                style={{ width: "100%", height: "auto", borderRadius: 12, display: "block" }}
                onError={() => setError("QR generation failed. Is the session active?")}
              />
            ) : (
              <div style={{
                width: "100%", aspectRatio: "1", borderRadius: 12,
                background: "rgba(107,114,128,0.1)", display: "flex",
                alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12,
              }}>
                <span style={{ fontSize: "3rem" }}>🔒</span>
                <span className="text-muted" style={{ fontSize: "0.85rem" }}>Session not active</span>
              </div>
            )}
          </div>

          {isActive && (
            <>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: "0.78rem", color: "var(--color-text-muted)", marginBottom: 6 }}>QR refreshes in</div>
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: "50%", border: "2px solid rgba(108,99,255,0.4)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "1.4rem", fontWeight: 800, color: "var(--color-primary-light)",
                    background: "rgba(108,99,255,0.08)",
                  }}>
                    {countdown}
                  </div>
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: 4 }}>seconds</div>
              </div>
              <button onClick={handleStop} className="btn btn-danger" disabled={stopping} style={{ width: "100%" }}>
                {stopping ? <><span className="spinner" /> Stopping…</> : "■ Stop Session"}
              </button>
            </>
          )}
        </div>

        {/* RIGHT — Attendance Roster */}
        <div className="glass" style={{ padding: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h2 style={{ fontSize: "0.85rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--color-text-muted)" }}>
              Attendance Roster
            </h2>
            <div style={{ textAlign: "right" }}>
              <span style={{ fontSize: "1.4rem", fontWeight: 800, color: "#10B981" }}>{presentCount}</span>
              <span className="text-muted" style={{ fontSize: "0.85rem" }}> / {totalStudents} present</span>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ height: 6, background: "rgba(107,114,128,0.2)", borderRadius: 3, marginBottom: 20, overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 3,
              background: "linear-gradient(90deg, #6C63FF, #22D3EE)",
              width: totalStudents > 0 ? `${(presentCount / totalStudents) * 100}%` : "0%",
              transition: "width 0.5s ease",
            }} />
          </div>

          {/* Roster list */}
          <div style={{ maxHeight: 520, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
            {roster.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <p className="text-muted" style={{ fontSize: "0.85rem" }}>No enrolled students yet.</p>
              </div>
            ) : (
              roster.map((r) => (
                <div key={r.studentId}>
                  {/* Student row */}
                  <div style={{
                    padding: "11px 13px", borderRadius: overridingStudentId === r.studentId ? "10px 10px 0 0" : 10,
                    background: r.status === "PRESENT" ? "rgba(16,185,129,0.06)" : "rgba(107,114,128,0.06)",
                    border: `1px solid ${r.status === "PRESENT" ? "rgba(16,185,129,0.2)" : "rgba(107,114,128,0.1)"}`,
                    borderBottom: overridingStudentId === r.studentId ? "none" : undefined,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: r.status === "PRESENT" ? 8 : 0 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{r.studentName}</div>
                        {r.studentRegNumber && (
                          <div className="text-muted" style={{ fontSize: "0.75rem" }}>{r.studentRegNumber}</div>
                        )}
                        {r.overrideReason && (
                          <div style={{ fontSize: "0.72rem", color: "var(--color-primary-light)", marginTop: 2 }}>
                            ✏️ Override: {r.overrideReason}
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0, marginLeft: 8 }}>
                        <span className={statusBadgeClass(r.status)}>{r.status}</span>
                        <button
                          onClick={() => overridingStudentId === r.studentId ? setOverridingStudentId(null) : openOverride(r.studentId)}
                          className="btn btn-ghost btn-sm"
                          style={{ padding: "3px 8px", fontSize: "0.75rem" }}
                          title="Manual override"
                        >
                          ✏️
                        </button>
                      </div>
                    </div>
                    {r.status === "PRESENT" && (
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <LockIcon pass={r.lock1TokenVerified} label="QR" />
                        <LockIcon pass={r.lock2GpsPassed || r.lock2WifiPassed} label="Location" />
                        <LockIcon pass={r.lock3BiometricVerified} label="Biometric" />
                        {r.distanceMeters != null && (
                          <span style={{ fontSize: "0.72rem", color: "var(--color-text-muted)" }}>
                            📍 {r.distanceMeters.toFixed(0)}m
                          </span>
                        )}
                        {r.verifiedAt && (
                          <span style={{ fontSize: "0.72rem", color: "var(--color-text-muted)" }}>
                            🕐 {new Date(r.verifiedAt).toLocaleTimeString()}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Inline override panel */}
                  {overridingStudentId === r.studentId && (
                    <div style={{
                      padding: "14px 13px",
                      background: "rgba(108,99,255,0.06)",
                      border: "1px solid rgba(108,99,255,0.25)",
                      borderTop: "none",
                      borderRadius: "0 0 10px 10px",
                    }}>
                      <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--color-primary-light)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        ✏️ Manual Override
                      </div>
                      {overrideError && (
                        <div style={{ fontSize: "0.78rem", color: "#EF4444", marginBottom: 8 }}>⚠️ {overrideError}</div>
                      )}
                      <form onSubmit={(e) => handleOverrideSubmit(e, r.studentId)} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <div style={{ display: "flex", gap: 8 }}>
                          <select
                            className="form-input"
                            style={{ flex: 1, padding: "7px 10px", fontSize: "0.82rem" }}
                            value={overrideStatus}
                            onChange={(e) => setOverrideStatus(e.target.value)}
                          >
                            <option value="PRESENT">Mark Present</option>
                            <option value="ABSENT">Mark Absent</option>
                            <option value="EXCUSED">Mark Excused</option>
                            <option value="LATE">Mark Late</option>
                          </select>
                        </div>
                        <input
                          className="form-input"
                          style={{ padding: "7px 10px", fontSize: "0.82rem" }}
                          placeholder="Reason (required, min 3 chars)"
                          value={overrideReason}
                          onChange={(e) => setOverrideReason(e.target.value)}
                          required
                          minLength={3}
                        />
                        <div style={{ display: "flex", gap: 6 }}>
                          <button type="submit" className="btn btn-primary btn-sm" disabled={overrideSubmitting} style={{ flex: 1 }}>
                            {overrideSubmitting ? <span className="spinner" /> : "Apply Override"}
                          </button>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOverridingStudentId(null)}>
                            Cancel
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {isActive && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--color-border)", display: "flex", justifyContent: "center" }}>
              <button onClick={handleStop} className="btn btn-danger btn-sm" disabled={stopping} style={{ width: "100%" }}>
                {stopping ? <><span className="spinner" /> Stopping…</> : "■ Stop Session"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Responsive grid */}
      <style>{`
        @media (max-width: 900px) {
          .live-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
