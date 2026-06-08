"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface HistoryRecord {
  id: string;
  sessionId: string;
  courseName: string;
  courseCode: string;
  classroomName: string;
  status: string;
  verifiedAt: string | null;
  lock1TokenVerified: boolean;
  lock2GpsPassed: boolean;
  lock2WifiPassed: boolean;
  lock3BiometricVerified: boolean;
  distanceMeters: number | null;
  sessionDate: string;
}

interface Summary {
  total: number;
  present: number;
  absent: number;
  attendanceRate: number;
}

function MiniLock({ pass, label }: { pass: boolean; label: string }) {
  return (
    <span
      title={label}
      style={{
        fontSize: "0.72rem",
        padding: "2px 7px",
        borderRadius: 6,
        background: pass ? "rgba(16,185,129,0.12)" : "rgba(107,114,128,0.12)",
        color: pass ? "#10B981" : "var(--color-text-muted)",
        fontWeight: 600,
        display: "inline-flex", alignItems: "center", gap: 3,
      }}
    >
      {pass ? "✓" : "○"} {label}
    </span>
  );
}

export default function StudentHistoryPage() {
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    fetch("/api/student/history", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); return; }
        setHistory(d.history ?? []);
        setSummary(d.summary ?? null);
      })
      .catch(() => setError("Failed to load attendance history."))
      .finally(() => setLoading(false));
  }, []);

  function statusBadgeClass(s: string) {
    if (s === "PRESENT")  return "badge badge-present";
    if (s === "ABSENT")   return "badge badge-absent";
    if (s === "LATE")     return "badge badge-late";
    return "badge badge-override";
  }

  function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }

  function formatTime(iso: string | null) {
    if (!iso) return null;
    return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div style={{ padding: "24px 20px", maxWidth: 600, margin: "0 auto" }}>
      {/* Page Title */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 4 }}>
          Attendance History
        </h1>
        <p className="text-secondary" style={{ fontSize: "0.85rem" }}>
          Track your attendance across all courses.
        </p>
      </div>

      {error && (
        <div style={{ padding: "12px 16px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10, color: "#EF4444", fontSize: "0.85rem", marginBottom: 20 }}>
          ⚠️ {error}
        </div>
      )}

      {/* Summary Stat Cards */}
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 28 }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 90, borderRadius: 14 }} />)}
        </div>
      ) : summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 28 }}>
          {/* Total */}
          <div className="glass" style={{ padding: "18px 16px", textAlign: "center" }}>
            <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--color-primary-light)", lineHeight: 1 }}>
              {summary.total}
            </div>
            <div className="text-muted" style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 6 }}>
              Sessions
            </div>
          </div>
          {/* Present */}
          <div className="glass" style={{ padding: "18px 16px", textAlign: "center" }}>
            <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#10B981", lineHeight: 1 }}>
              {summary.present}
            </div>
            <div className="text-muted" style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 6 }}>
              Present
            </div>
          </div>
          {/* Rate */}
          <div className="glass" style={{ padding: "18px 16px", textAlign: "center" }}>
            <div style={{
                fontSize: "1.8rem", fontWeight: 800, lineHeight: 1,
                color: summary.attendanceRate >= 75 ? "#10B981" : "#EF4444",
              }}
            >
              {summary.attendanceRate}%
            </div>
            <div className="text-muted" style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 6 }}>
              Rate
            </div>
          </div>
        </div>
      )}

      {/* Attendance Rate Progress Bar */}
      {!loading && summary && summary.total > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ height: 8, background: "rgba(107,114,128,0.2)", borderRadius: 4, overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 4,
              background: summary.attendanceRate >= 75
                ? "linear-gradient(90deg, #10B981, #22D3EE)"
                : "linear-gradient(90deg, #EF4444, #F59E0B)",
              width: `${summary.attendanceRate}%`,
              transition: "width 0.8s ease",
            }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            <span className="text-muted" style={{ fontSize: "0.72rem" }}>0%</span>
            <span className="text-muted" style={{ fontSize: "0.72rem" }}>
              {summary.attendanceRate >= 75 ? "✅ Good standing" : "⚠️ Below 75% threshold"}
            </span>
            <span className="text-muted" style={{ fontSize: "0.72rem" }}>100%</span>
          </div>
        </div>
      )}

      {/* History List */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 100, borderRadius: 14 }} />)}
        </div>
      ) : history.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{ fontSize: "3rem", marginBottom: 14 }}>📋</div>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 8 }}>No Records Yet</h2>
          <p className="text-muted" style={{ fontSize: "0.85rem", marginBottom: 20 }}>
            Join a class session to start building your attendance history.
          </p>
          <Link href="/student/scan" className="btn btn-primary btn-sm" style={{ textDecoration: "none" }}>
            📷 Mark Attendance
          </Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {history.map((record) => (
            <div
              key={record.id}
              className="glass"
              style={{
                padding: "16px 18px",
                borderLeft: `3px solid ${record.status === "PRESENT" ? "#10B981" : record.status === "ABSENT" ? "#EF4444" : "#F59E0B"}`,
              }}
            >
              {/* Top row */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.92rem" }}>{record.courseCode}</div>
                  <div className="text-secondary" style={{ fontSize: "0.8rem" }}>{record.courseName}</div>
                </div>
                <span className={statusBadgeClass(record.status)}>
                  {record.status}
                </span>
              </div>

              {/* Meta row */}
              <div style={{ display: "flex", gap: 12, marginBottom: record.status === "PRESENT" ? 10 : 0 }}>
                <span className="text-muted" style={{ fontSize: "0.75rem" }}>
                  📅 {formatDate(record.sessionDate)}
                </span>
                {record.verifiedAt && (
                  <span className="text-muted" style={{ fontSize: "0.75rem" }}>
                    🕐 {formatTime(record.verifiedAt)}
                  </span>
                )}
                <span className="text-muted" style={{ fontSize: "0.75rem" }}>
                  📍 {record.classroomName}
                </span>
              </div>

              {/* Lock indicators — only for PRESENT */}
              {record.status === "PRESENT" && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  <MiniLock pass={record.lock1TokenVerified} label="QR" />
                  <MiniLock pass={record.lock2GpsPassed || record.lock2WifiPassed} label="Location" />
                  <MiniLock pass={record.lock3BiometricVerified} label="Biometric" />
                  {record.distanceMeters != null && (
                    <span className="text-muted" style={{ fontSize: "0.72rem" }}>
                      · 📍 {record.distanceMeters.toFixed(0)}m away
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
