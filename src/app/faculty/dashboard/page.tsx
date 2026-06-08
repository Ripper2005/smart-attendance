"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface DashboardData {
  totalCourses: number;
  activeSessionsToday: number;
  totalAttendanceRecords: number;
  todaySessions: {
    id: string;
    courseCode: string;
    courseName: string;
    classroomName: string;
    status: string;
    startedAt: string | null;
  }[];
}

function StatCard({ icon, label, value, color, loading }: {
  icon: string; label: string; value: number | string;
  color: string; loading: boolean;
}) {
  return (
    <div className="glass" style={{ padding: 28, flex: 1, minWidth: 180 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, display: "flex",
          alignItems: "center", justifyContent: "center", fontSize: 20,
          background: `${color}20`, border: `1px solid ${color}40`,
        }}>{icon}</div>
      </div>
      {loading ? (
        <div className="skeleton" style={{ height: 36, width: 80, marginBottom: 8 }} />
      ) : (
        <div style={{ fontSize: "2rem", fontWeight: 800, lineHeight: 1, marginBottom: 6, color }}>{value}</div>
      )}
      <div className="text-muted" style={{ fontSize: "0.8rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
    </div>
  );
}

export default function FacultyDashboardPage() {
  const [data, setData]       = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    fetch("/api/faculty/dashboard", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { setError("Failed to load dashboard data."); setLoading(false); });
  }, []);

  function statusBadgeClass(status: string) {
    if (status === "ACTIVE")    return "badge badge-active";
    if (status === "COMPLETED") return "badge badge-absent";
    return "badge badge-override";
  }

  return (
    <div style={{ padding: "32px 36px" }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: "1.8rem", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 6 }}>
          Faculty Dashboard
        </h1>
        <p className="text-secondary" style={{ fontSize: "0.9rem" }}>
          Welcome back — here&apos;s what&apos;s happening today.
        </p>
      </div>

      {error && (
        <div style={{ padding: "14px 18px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, color: "#EF4444", marginBottom: 24 }}>
          ⚠️ {error}
        </div>
      )}

      {/* Stat Cards */}
      <div style={{ display: "flex", gap: 20, marginBottom: 36, flexWrap: "wrap" }}>
        <StatCard icon="📚" label="Total Courses"          value={data?.totalCourses ?? 0}            color="#6C63FF" loading={loading} />
        <StatCard icon="🔴" label="Active Sessions Today"  value={data?.activeSessionsToday ?? 0}     color="#22D3EE" loading={loading} />
        <StatCard icon="✅" label="Attendance Records"     value={data?.totalAttendanceRecords ?? 0}  color="#10B981" loading={loading} />
      </div>

      {/* Today's Sessions */}
      <div className="glass" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 700 }}>Today&apos;s Sessions</h2>
          <Link href="/faculty/sessions" className="btn btn-ghost btn-sm" style={{ textDecoration: "none" }}>
            View All →
          </Link>
        </div>

        {loading ? (
          <div style={{ padding: "24px" }}>
            {[1,2,3].map((i) => (
              <div key={i} className="skeleton" style={{ height: 52, borderRadius: 8, marginBottom: 12 }} />
            ))}
          </div>
        ) : !data?.todaySessions?.length ? (
          <div style={{ padding: "48px 24px", textAlign: "center" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>📋</div>
            <p className="text-muted" style={{ fontSize: "0.9rem" }}>No sessions today. <Link href="/faculty/sessions" style={{ color: "var(--color-primary-light)", textDecoration: "none" }}>Create one →</Link></p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                  {["Course", "Classroom", "Status", "Started At", "Action"].map((h) => (
                    <th key={h} style={{ padding: "12px 20px", textAlign: "left", fontSize: "0.75rem", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.todaySessions.map((s, i) => (
                  <tr key={s.id} style={{ borderBottom: i < data.todaySessions.length - 1 ? "1px solid var(--color-border)" : "none" }}>
                    <td style={{ padding: "14px 20px" }}>
                      <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{s.courseCode}</div>
                      <div className="text-muted" style={{ fontSize: "0.78rem" }}>{s.courseName}</div>
                    </td>
                    <td style={{ padding: "14px 20px", fontSize: "0.88rem", color: "var(--color-text-secondary)" }}>{s.classroomName}</td>
                    <td style={{ padding: "14px 20px" }}>
                      <span className={statusBadgeClass(s.status)}>
                        {s.status === "ACTIVE" && <span className="pulse-dot" />}
                        {s.status}
                      </span>
                    </td>
                    <td style={{ padding: "14px 20px", fontSize: "0.85rem", color: "var(--color-text-secondary)" }}>
                      {s.startedAt ? new Date(s.startedAt).toLocaleTimeString() : "—"}
                    </td>
                    <td style={{ padding: "14px 20px" }}>
                      <Link
                        href={`/faculty/sessions/${s.id}/live`}
                        className="btn btn-primary btn-sm"
                        style={{ textDecoration: "none" }}
                      >
                        {s.status === "ACTIVE" ? "🔴 Live →" : "Manage →"}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
