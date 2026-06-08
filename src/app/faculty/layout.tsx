"use client";

/**
 * Faculty Layout — persistent sidebar + mobile bottom nav.
 * Wraps all /faculty/* routes.
 * Auth guard: redirects to /auth/login if no valid FACULTY user in localStorage.
 */

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

interface StoredUser {
  id: string;
  fullName: string;
  email: string;
  role: string;
}

const NAV_ITEMS = [
  { href: "/faculty/dashboard", icon: "🏠", label: "Dashboard" },
  { href: "/faculty/courses",   icon: "📚", label: "Courses"   },
  { href: "/faculty/sessions",  icon: "📋", label: "Sessions"  },
];

export default function FacultyLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [user, setUser]       = useState<StoredUser | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("user");
    if (!stored) { router.push("/auth/login"); return; }
    try {
      const parsed: StoredUser = JSON.parse(stored);
      if (parsed.role !== "FACULTY") { router.push("/auth/login"); return; }
      setUser(parsed);
    } catch {
      router.push("/auth/login");
    }
  }, [router]);

  function handleSignOut() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
    document.cookie = "access_token=; max-age=0; path=/";
    router.push("/auth/login");
  }

  // Don't render until mounted (prevents SSR mismatch)
  if (!mounted || !user) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* ── SIDEBAR (desktop) ─────────────────────────────── */}
      <aside
        style={{
          width: 240,
          flexShrink: 0,
          background: "var(--color-surface)",
          borderRight: "1px solid var(--color-border)",
          display: "flex",
          flexDirection: "column",
          padding: "24px 0",
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          zIndex: 40,
        }}
        className="faculty-sidebar"
      >
        {/* Logo */}
        <div style={{ padding: "0 20px 28px", borderBottom: "1px solid var(--color-border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36,
              background: "linear-gradient(135deg, #6C63FF, #22D3EE)",
              borderRadius: 10, display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 18,
            }}>🛡️</div>
            <span style={{ fontWeight: 700, fontSize: "1rem", letterSpacing: "-0.02em" }}>
              Smart<span className="gradient-text">Attend</span>
            </span>
          </div>
          <div style={{ marginTop: 8, fontSize: "0.72rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Faculty Portal
          </div>
        </div>

        {/* Nav Items */}
        <nav style={{ flex: 1, padding: "20px 12px" }}>
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "11px 14px", borderRadius: 10, marginBottom: 4,
                  textDecoration: "none", fontSize: "0.9rem", fontWeight: 500,
                  transition: "all 0.2s",
                  background: isActive ? "rgba(108,99,255,0.12)" : "transparent",
                  color: isActive ? "var(--color-primary-light)" : "var(--color-text-secondary)",
                  borderLeft: isActive ? "3px solid var(--color-primary)" : "3px solid transparent",
                }}
              >
                <span style={{ fontSize: "1.1rem" }}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User Footer */}
        <div style={{ padding: "16px 12px", borderTop: "1px solid var(--color-border)" }}>
          <div style={{ padding: "10px 14px", marginBottom: 8 }}>
            <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 2 }}>
              {user.fullName}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>{user.email}</div>
          </div>
          <button
            onClick={handleSignOut}
            className="btn btn-ghost btn-sm"
            style={{ width: "100%", justifyContent: "flex-start", gap: 8 }}
          >
            🚪 Sign Out
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ──────────────────────────────────── */}
      <main
        style={{
          flex: 1,
          marginLeft: 240,
          minHeight: "100vh",
          paddingBottom: 80, // space for mobile bottom nav
        }}
        className="faculty-main"
      >
        {children}
      </main>

      {/* ── BOTTOM NAV (mobile) ───────────────────────────── */}
      <nav
        className="faculty-mobile-nav"
        style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
          background: "var(--color-surface)",
          borderTop: "1px solid var(--color-border)",
          display: "flex",
          padding: "8px 0",
        }}
      >
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
                gap: 3, padding: "6px 0", textDecoration: "none", fontSize: "0.65rem",
                fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em",
                color: isActive ? "var(--color-primary-light)" : "var(--color-text-muted)",
                transition: "color 0.2s",
              }}
            >
              <span style={{ fontSize: "1.3rem" }}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Responsive styles */}
      <style>{`
        @media (max-width: 768px) {
          .faculty-sidebar { display: none !important; }
          .faculty-main { margin-left: 0 !important; }
          .faculty-mobile-nav { display: flex !important; }
        }
        @media (min-width: 769px) {
          .faculty-mobile-nav { display: none !important; }
        }
      `}</style>
    </div>
  );
}
