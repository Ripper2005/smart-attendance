"use client";

import { useEffect, useState, FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

interface Session {
  id: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  classroomName: string;
  classroomBuilding: string | null;
  status: string;
  startedAt: string | null;
  endedAt: string | null;
  presentCount: number;
}

interface Course { id: string; courseCode: string; courseName: string; }
interface Classroom { id: string; name: string; building: string | null; }

function SessionsContent() {
  const searchParams = useSearchParams();
  const defaultCourse = searchParams.get("courseId") ?? "";

  const [sessions, setSessions]     = useState<Session[]>([]);
  const [courses, setCourses]       = useState<Course[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading]       = useState(true);
  const [filterCourse, setFilterCourse] = useState(defaultCourse);
  const [showModal, setShowModal]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError]   = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Form state
  const [selCourse, setSelCourse]     = useState(defaultCourse);
  const [selClassroom, setSelClassroom] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(90);

  function getToken() { return localStorage.getItem("access_token") ?? ""; }

  async function fetchSessions(courseId?: string) {
    setLoading(true);
    const url = courseId ? `/api/faculty/sessions?courseId=${courseId}` : "/api/faculty/sessions";
    const res = await fetch(url, { headers: { Authorization: `Bearer ${getToken()}` } });
    const data = await res.json();
    if (res.ok) setSessions(data.sessions);
    setLoading(false);
  }

  async function fetchMeta() {
    const [cRes, clRes] = await Promise.all([
      fetch("/api/faculty/courses",    { headers: { Authorization: `Bearer ${getToken()}` } }),
      fetch("/api/faculty/classrooms", { headers: { Authorization: `Bearer ${getToken()}` } }),
    ]);
    const [cData, clData] = await Promise.all([cRes.json(), clRes.json()]);
    if (cRes.ok)  setCourses(cData.courses ?? []);
    if (clRes.ok) setClassrooms(clData.classrooms ?? []);
  }

  useEffect(() => {
    fetchMeta();
    fetchSessions(defaultCourse || undefined);
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    const res = await fetch("/api/faculty/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ courseId: selCourse, classroomId: selClassroom, durationMinutes }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) { setFormError(data.error ?? "Failed to create session."); return; }
    setShowModal(false);
    setSelCourse(""); setSelClassroom("");
    fetchSessions(filterCourse || undefined);
  }

  async function handleAction(sessionId: string, action: "start" | "stop") {
    setActionLoading(sessionId);
    const res = await fetch(`/api/faculty/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ action }),
    });
    setActionLoading(null);
    if (res.ok) fetchSessions(filterCourse || undefined);
  }

  function statusBadgeClass(s: string) {
    if (s === "ACTIVE")    return "badge badge-active";
    if (s === "COMPLETED") return "badge badge-absent";
    return "badge badge-override";
  }

  const filtered = filterCourse ? sessions.filter(s => s.courseId === filterCourse) : sessions;

  return (
    <div style={{ padding: "32px 36px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 6 }}>Sessions</h1>
          <p className="text-secondary" style={{ fontSize: "0.9rem" }}>Start a session to begin real-time attendance.</p>
        </div>
        <button onClick={() => { setShowModal(true); setFormError(null); }} className="btn btn-primary">
          + Create Session
        </button>
      </div>

      {/* Filter bar */}
      <div style={{ marginBottom: 24, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <select
          className="form-input"
          style={{ maxWidth: 260 }}
          value={filterCourse}
          onChange={(e) => { setFilterCourse(e.target.value); fetchSessions(e.target.value || undefined); }}
        >
          <option value="">All Courses</option>
          {courses.map(c => <option key={c.id} value={c.id}>{c.courseCode} — {c.courseName}</option>)}
        </select>
        <span className="text-muted" style={{ fontSize: "0.85rem" }}>{filtered.length} session{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Sessions List */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 76, borderRadius: 12 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 24px" }}>
          <div style={{ fontSize: "3rem", marginBottom: 12 }}>📋</div>
          <p className="text-muted" style={{ fontSize: "0.9rem" }}>No sessions found. Create one to get started.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map((s) => (
            <div key={s.id} className="glass" style={{ padding: "18px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>{s.courseCode}</span>
                  <span className={statusBadgeClass(s.status)}>
                    {s.status === "ACTIVE" && <span className="pulse-dot" />}
                    {s.status}
                  </span>
                </div>
                <div className="text-secondary" style={{ fontSize: "0.82rem" }}>
                  {s.classroomName}{s.classroomBuilding ? ` · ${s.classroomBuilding}` : ""}
                  {s.startedAt ? ` · Started ${new Date(s.startedAt).toLocaleTimeString()}` : ""}
                  {s.status === "ACTIVE" && ` · ✅ ${s.presentCount} present`}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {s.status === "SCHEDULED" && (
                  <Link href={`/faculty/sessions/${s.id}/live`} className="btn btn-primary btn-sm" style={{ textDecoration: "none" }}>
                    ▶ Start
                  </Link>
                )}
                {s.status === "ACTIVE" && (
                  <>
                    <Link href={`/faculty/sessions/${s.id}/live`} className="btn btn-primary btn-sm" style={{ textDecoration: "none" }}>
                      🔴 View QR
                    </Link>
                    <button
                      onClick={() => handleAction(s.id, "stop")}
                      className="btn btn-danger btn-sm"
                      disabled={actionLoading === s.id}
                    >
                      {actionLoading === s.id ? <span className="spinner" /> : "■ Stop"}
                    </button>
                  </>
                )}
                {s.status === "COMPLETED" && (
                  <Link href={`/faculty/sessions/${s.id}/live`} className="btn btn-secondary btn-sm" style={{ textDecoration: "none" }}>
                    View Report
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Session Modal */}
      {showModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 100,
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
        }} onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="glass animate-fadeIn" style={{ width: "100%", maxWidth: 480, padding: 32 }}>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: 24 }}>Create New Session</h2>
            {formError && (
              <div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, color: "#EF4444", fontSize: "0.85rem", marginBottom: 16 }}>
                ⚠️ {formError}
              </div>
            )}
            <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div className="form-group">
                <label className="form-label" htmlFor="sess-course">Course *</label>
                <select id="sess-course" className="form-input" value={selCourse} onChange={e => setSelCourse(e.target.value)} required>
                  <option value="">Select a course…</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.courseCode} — {c.courseName}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="sess-classroom">Classroom *</label>
                <select id="sess-classroom" className="form-input" value={selClassroom} onChange={e => setSelClassroom(e.target.value)} required>
                  <option value="">Select a classroom…</option>
                  {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}{c.building ? ` (${c.building})` : ""}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="sess-duration">Session Duration *</label>
                <select id="sess-duration" className="form-input" value={durationMinutes} onChange={e => setDurationMinutes(Number(e.target.value))} required>
                  <option value={30}>30 minutes</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>60 minutes</option>
                  <option value={90}>90 minutes</option>
                  <option value={120}>120 minutes</option>
                </select>
              </div>
              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-ghost">Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? <><span className="spinner" /> Creating…</> : "Create Session"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SessionsPage() {
  return <Suspense><SessionsContent /></Suspense>;
}
