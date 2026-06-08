"use client";

import { useEffect, useState, FormEvent } from "react";

interface Course {
  id: string;
  courseCode: string;
  courseName: string;
  semester: string | null;
  enrollmentCount: number;
  sessionCount: number;
}

export default function CoursesPage() {
  const [courses, setCourses]     = useState<Course[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Form state
  const [courseCode, setCourseCode] = useState("");
  const [courseName, setCourseName] = useState("");
  const [semester, setSemester]     = useState("");

  function getToken() { return localStorage.getItem("access_token") ?? ""; }

  async function fetchCourses() {
    setLoading(true);
    try {
      const res = await fetch("/api/faculty/courses", { headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      if (res.ok) setCourses(data.courses);
      else setError(data.error ?? "Failed to load courses.");
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  }

  useEffect(() => { fetchCourses(); }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/faculty/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ courseCode, courseName, semester }),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error ?? "Failed to create course."); return; }
      setCourseCode(""); setCourseName(""); setSemester("");
      setShowForm(false);
      fetchCourses();
    } catch { setFormError("Network error."); }
    finally { setSubmitting(false); }
  }

  return (
    <div style={{ padding: "32px 36px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 6 }}>Courses</h1>
          <p className="text-secondary" style={{ fontSize: "0.9rem" }}>Manage your courses and enrollments.</p>
        </div>
        <button onClick={() => { setShowForm(!showForm); setFormError(null); }} className="btn btn-primary">
          {showForm ? "✕ Cancel" : "+ Create Course"}
        </button>
      </div>

      {error && (
        <div style={{ padding: "14px 18px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, color: "#EF4444", marginBottom: 24 }}>
          ⚠️ {error}
        </div>
      )}

      {/* Create Course Form */}
      {showForm && (
        <div className="glass" style={{ padding: 28, marginBottom: 32 }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: 20 }}>New Course</h2>
          {formError && (
            <div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, color: "#EF4444", fontSize: "0.85rem", marginBottom: 16 }}>
              ⚠️ {formError}
            </div>
          )}
          <form onSubmit={handleCreate} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 16, alignItems: "flex-end" }}>
            <div className="form-group">
              <label className="form-label" htmlFor="courseCode">Course Code *</label>
              <input id="courseCode" className="form-input" placeholder="e.g. CS-401" value={courseCode} onChange={e => setCourseCode(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="courseName">Course Name *</label>
              <input id="courseName" className="form-input" placeholder="e.g. Advanced Algorithms" value={courseName} onChange={e => setCourseName(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="semester">Semester</label>
              <input id="semester" className="form-input" placeholder="e.g. 2025-B" value={semester} onChange={e => setSemester(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={submitting} style={{ alignSelf: "flex-end" }}>
              {submitting ? <><span className="spinner" /> Saving…</> : "Create Course"}
            </button>
          </form>
        </div>
      )}

      {/* Course Grid */}
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 160, borderRadius: 16 }} />)}
        </div>
      ) : courses.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 24px" }}>
          <div style={{ fontSize: "3.5rem", marginBottom: 16 }}>📚</div>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: 8 }}>No courses yet</h2>
          <p className="text-muted" style={{ fontSize: "0.9rem" }}>Create your first course to get started.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
          {courses.map((course) => (
            <div key={course.id} className="glass glass-hover" style={{ padding: 24 }}>
              <div style={{ marginBottom: 12 }}>
                <span className="gradient-text" style={{ fontSize: "1.4rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
                  {course.courseCode}
                </span>
                {course.semester && (
                  <span className="badge badge-override" style={{ marginLeft: 8 }}>{course.semester}</span>
                )}
              </div>
              <p style={{ fontSize: "0.92rem", fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 16 }}>{course.courseName}</p>
              <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
                <span className="text-muted" style={{ fontSize: "0.8rem" }}>👥 {course.enrollmentCount} students</span>
                <span className="text-muted" style={{ fontSize: "0.8rem" }}>📋 {course.sessionCount} sessions</span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <a
                  href={`/faculty/courses/${course.id}`}
                  className="btn btn-primary btn-sm"
                  style={{ textDecoration: "none", display: "inline-flex" }}
                >
                  👥 Students
                </a>
                <a
                  href={`/faculty/sessions?courseId=${course.id}`}
                  className="btn btn-secondary btn-sm"
                  style={{ textDecoration: "none", display: "inline-flex" }}
                >
                  Sessions →
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
