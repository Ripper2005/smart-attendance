"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface StoredUser {
  id: string;
  fullName: string;
  email: string;
  role: string;
}

export default function StudentDashboardPage() {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [biometricsStatus, setBiometricsStatus] = useState<"loading" | "registered" | "not_registered">("loading");
  const [stats, setStats] = useState<{ total: number; present: number; rate: number } | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  function getToken() {
    return localStorage.getItem("access_token") ?? "";
  }

  useEffect(() => {
    // 1. Get user from localStorage
    const stored = localStorage.getItem("user");
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch (e) {
        console.error("Error parsing user from localStorage:", e);
      }
    }

    // 2. Check biometrics options
    fetch("/api/webauthn/register/options", {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch WebAuthn options");
        return res.json();
      })
      .then((data) => {
        if (data.excludeCredentials && data.excludeCredentials.length > 0) {
          setBiometricsStatus("registered");
        } else {
          setBiometricsStatus("not_registered");
        }
      })
      .catch((err) => {
        console.error("Error checking biometrics status:", err);
        setBiometricsStatus("not_registered");
      });

    // 3. Fetch history stats
    fetch("/api/student/history", {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch history");
        return res.json();
      })
      .then((data) => {
        const historyList = data.history ?? [];
        const presentCount = historyList.filter((h: any) => h.status === "PRESENT").length;
        const totalCount = historyList.length;
        const rate = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;
        setStats({ total: totalCount, present: presentCount, rate });
      })
      .catch((err) => {
        console.error("Error fetching student history:", err);
      })
      .finally(() => {
        setLoadingStats(false);
      });
  }, []);

  const firstName = user?.fullName?.split(" ")[0] ?? "Student";

  return (
    <div style={{ padding: "24px 20px", maxWidth: 480, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Greeting Banner */}
      <div style={{ marginTop: 8 }}>
        <p className="text-secondary" style={{ fontSize: "0.85rem", marginBottom: 4 }}>Welcome back,</p>
        <h1 style={{ fontSize: "1.8rem", fontWeight: 800, letterSpacing: "-0.03em" }}>
          Hi, <span className="gradient-text">{firstName}</span> 👋
        </h1>
        <p className="text-muted" style={{ fontSize: "0.82rem", marginTop: 4 }}>
          Keep your attendance secure and anti-proxy locks verified.
        </p>
      </div>

      {/* Action Cards Stack */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Card 1: Scan Attendance (Primary CTA) */}
        <Link href="/student/scan" style={{ textDecoration: "none" }}>
          <button className="btn btn-primary btn-lg" style={{ width: "100%", padding: "20px 24px", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, textAlign: "left" }}>
              <span style={{ fontSize: "2rem" }}>📷</span>
              <div>
                <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#FFF" }}>Mark Attendance</div>
                <div style={{ fontSize: "0.78rem", color: "rgba(255, 255, 255, 0.7)", fontWeight: 500, marginTop: 2 }}>Scan class QR code & verify locks</div>
              </div>
            </div>
            <span style={{ fontSize: "1.4rem" }}>→</span>
          </button>
        </Link>

        {/* Card 2: My History */}
        <Link href="/student/history" style={{ textDecoration: "none" }}>
          <div className="glass" style={{ padding: "18px 20px", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "space-between", transition: "transform 0.2s" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ fontSize: "1.6rem" }}>📋</span>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: "0.95rem", fontWeight: 700 }}>My History</div>
                <div className="text-secondary" style={{ fontSize: "0.78rem", marginTop: 2 }}>View log records & verification details</div>
              </div>
            </div>
            <span style={{ color: "var(--color-text-muted)" }}>→</span>
          </div>
        </Link>

        {/* Card 3: Biometrics */}
        <Link href="/student/biometrics" style={{ textDecoration: "none" }}>
          <div className="glass" style={{ padding: "18px 20px", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "space-between", transition: "transform 0.2s" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ fontSize: "1.6rem" }}>🧬</span>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: "0.95rem", fontWeight: 700 }}>Biometrics</div>
                <div className="text-secondary" style={{ fontSize: "0.78rem", marginTop: 2 }}>Device WebAuthn registration</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {biometricsStatus === "loading" && <span className="spinner" style={{ width: 14, height: 14 }} />}
              {biometricsStatus === "registered" && (
                <span className="badge badge-present" style={{ fontSize: "0.72rem", padding: "3px 8px" }}>
                  Registered ✓
                </span>
              )}
              {biometricsStatus === "not_registered" && (
                <span className="badge badge-override" style={{ fontSize: "0.72rem", padding: "3px 8px" }}>
                  Not set up ⚠️
                </span>
              )}
              <span style={{ color: "var(--color-text-muted)", marginLeft: 4 }}>→</span>
            </div>
          </div>
        </Link>
      </div>

      {/* Quick Stats Section */}
      <div className="glass" style={{ padding: 24, borderRadius: 16 }}>
        <h3 style={{ fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-muted)", marginBottom: 18 }}>
          Quick Stats
        </h3>

        {loadingStats ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="skeleton" style={{ height: 70, borderRadius: 12 }} />
            <div className="skeleton" style={{ height: 70, borderRadius: 12 }} />
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {/* Stat 1: Attended */}
              <div style={{ background: "rgba(107,114,128,0.05)", padding: "14px 16px", borderRadius: 12, border: "1px solid var(--color-border)" }}>
                <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#10B981" }}>
                  {stats?.present ?? 0}
                </div>
                <div className="text-muted" style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginTop: 4 }}>
                  Attended
                </div>
              </div>

              {/* Stat 2: Rate */}
              <div style={{ background: "rgba(107,114,128,0.05)", padding: "14px 16px", borderRadius: 12, border: "1px solid var(--color-border)" }}>
                <div style={{ fontSize: "1.6rem", fontWeight: 800, color: (stats?.rate ?? 0) >= 75 ? "var(--color-primary-light)" : "#EF4444" }}>
                  {stats?.rate ?? 0}%
                </div>
                <div className="text-muted" style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginTop: 4 }}>
                  Rate
                </div>
              </div>
            </div>

            {/* Attendance Progress Bar */}
            {stats && stats.total > 0 && (
              <div>
                <div style={{ height: 6, background: "rgba(107,114,128,0.15)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 3,
                    background: stats.rate >= 75
                      ? "linear-gradient(90deg, #6C63FF, #22D3EE)"
                      : "linear-gradient(90deg, #EF4444, #F59E0B)",
                    width: `${stats.rate}%`,
                    transition: "width 0.5s ease",
                  }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: "0.72rem" }}>
                  <span className="text-muted">
                    {stats.rate >= 75 ? "✅ Safe standing (≥75%)" : "⚠️ Warning: Below 75% requirement"}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
