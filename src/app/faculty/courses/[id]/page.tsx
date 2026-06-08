"use client";

import { useEffect, useState, FormEvent } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface CourseDetail {
  id: string;
  courseCode: string;
  courseName: string;
  semester: string | null;
}

interface EnrolledStudent {
  enrollmentId: string;
  studentId: string;
  fullName: string;
  email: string;
  studentRegNumber: string | null;
  enrolledAt: string;
}

export default function CourseDetailPage() {
  const params = useParams();
  const courseId = params.id as string;

  const [course, setCourse]         = useState<CourseDetail | null>(null);
  const [students, setStudents]     = useState<EnrolledStudent[]>([]);
  const [loading, setLoading]       = useState(true);
  const [enrollEmail, setEnrollEmail] = useState("");
  const [enrolling, setEnrolling]   = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [enrollSuccess, setEnrollSuccess] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  function getToken() { return localStorage.getItem("access_token") ?? ""; }

  async function fetchCourse() {
    const res = await fetch("/api/faculty/courses", {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const data = await res.json();
    if (res.ok) {
      const found = (data.courses ?? []).find((c: CourseDetail) => c.id === courseId);
      if (found) setCourse(found);
    }
  }

  async function fetchStudents() {
    const res = await fetch(`/api/faculty/courses/${courseId}/students`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const data = await res.json();
    if (res.ok) setStudents(data.students ?? []);
    setLoading(false);
  }

  useEffect(() => {
    fetchCourse();
    fetchStudents();
  }, [courseId]);

  async function handleEnroll(e: FormEvent) {
    e.preventDefault();
    setEnrollError(null);
    setEnrollSuccess(null);
    setEnrolling(true);
    const res = await fetch(`/api/faculty/courses/${courseId}/enroll`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ studentEmail: enrollEmail.trim() }),
    });
    const data = await res.json();
    setEnrolling(false);
    if (!res.ok) { setEnrollError(data.error ?? "Enrollment failed."); return; }
    setEnrollSuccess(`✅ ${data.enrollment.studentName} enrolled successfully.`);
    setEnrollEmail("");
    fetchStudents();
  }

  async function handleRemove(studentId: string, name: string) {
    if (!confirm(`Remove ${name} from this course?`)) return;
    setRemovingId(studentId);
    const res = await fetch(`/api/faculty/courses/${courseId}/enroll`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ studentId }),
    });
    setRemovingId(null);
    if (res.ok) fetchStudents();
  }

  return (
    <div style={{ padding: "32px 36px" }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 24 }}>
        <Link href="/faculty/courses" className="text-muted" style={{ fontSize: "0.85rem", textDecoration: "none" }}>
          ← Courses
        </Link>
      </div>

      {/* Course Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 6 }}>
          <h1 className="gradient-text" style={{ fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
            {course?.courseCode ?? "…"}
          </h1>
          {course?.semester && (
            <span className="badge badge-override">{course.semester}</span>
          )}
        </div>
        <p style={{ fontSize: "1rem", color: "var(--color-text-secondary)", fontWeight: 500 }}>
          {course?.courseName}
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 24, alignItems: "start" }}
        className="enroll-grid">

        {/* Student List */}
        <div className="glass" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: "0.95rem", fontWeight: 700 }}>
              Enrolled Students
              <span className="text-muted" style={{ fontWeight: 400, marginLeft: 8, fontSize: "0.85rem" }}>
                ({students.length})
              </span>
            </h2>
          </div>

          {loading ? (
            <div style={{ padding: 24 }}>
              {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 52, borderRadius: 8, marginBottom: 10 }} />)}
            </div>
          ) : students.length === 0 ? (
            <div style={{ padding: "48px 24px", textAlign: "center" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>👥</div>
              <p className="text-muted" style={{ fontSize: "0.88rem" }}>
                No students enrolled yet. Add students using the form →
              </p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                    {["Name", "Email", "Reg Number", "Enrolled", ""].map((h) => (
                      <th key={h} style={{ padding: "10px 20px", textAlign: "left", fontSize: "0.72rem", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {students.map((s, i) => (
                    <tr key={s.enrollmentId} style={{ borderBottom: i < students.length - 1 ? "1px solid var(--color-border)" : "none" }}>
                      <td style={{ padding: "13px 20px" }}>
                        <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{s.fullName}</div>
                      </td>
                      <td style={{ padding: "13px 20px", fontSize: "0.82rem", color: "var(--color-text-secondary)" }}>{s.email}</td>
                      <td style={{ padding: "13px 20px", fontSize: "0.82rem", color: "var(--color-text-muted)" }}>
                        {s.studentRegNumber ?? "—"}
                      </td>
                      <td style={{ padding: "13px 20px", fontSize: "0.78rem", color: "var(--color-text-muted)" }}>
                        {new Date(s.enrolledAt).toLocaleDateString()}
                      </td>
                      <td style={{ padding: "13px 20px" }}>
                        <button
                          onClick={() => handleRemove(s.studentId, s.fullName)}
                          className="btn btn-danger btn-sm"
                          disabled={removingId === s.studentId}
                        >
                          {removingId === s.studentId ? <span className="spinner" /> : "Remove"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Enroll Form */}
        <div className="glass" style={{ padding: 24 }}>
          <h2 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: 20 }}>Add Student</h2>

          {enrollSuccess && (
            <div style={{ padding: "10px 14px", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 8, fontSize: "0.82rem", color: "#10B981", marginBottom: 14 }}>
              {enrollSuccess}
            </div>
          )}
          {enrollError && (
            <div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, fontSize: "0.82rem", color: "#EF4444", marginBottom: 14 }}>
              ⚠️ {enrollError}
            </div>
          )}

          <form onSubmit={handleEnroll} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="form-group">
              <label className="form-label" htmlFor="enroll-email">Student Email *</label>
              <input
                id="enroll-email"
                type="email"
                className="form-input"
                placeholder="student@university.edu"
                value={enrollEmail}
                onChange={(e) => { setEnrollEmail(e.target.value); setEnrollError(null); setEnrollSuccess(null); }}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={enrolling}>
              {enrolling ? <><span className="spinner" /> Enrolling…</> : "+ Enroll Student"}
            </button>
          </form>

          <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--color-border)" }}>
            <p className="text-muted" style={{ fontSize: "0.78rem", lineHeight: 1.6 }}>
              The student must already have a registered account with role STUDENT.
              They will be able to mark attendance in sessions for this course.
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .enroll-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
