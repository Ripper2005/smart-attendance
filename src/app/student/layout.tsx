"use client";

/**
 * Student Layout — mobile-first PWA shell.
 * Fixed bottom nav + thin header. No sidebar.
 * Auth guard: redirects to /auth/login if no STUDENT user in localStorage.
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
  { href: "/student/dashboard",  icon: "🏠", label: "Dashboard" },
  { href: "/student/scan",       icon: "📷", label: "Scan"      },
  { href: "/student/history",    icon: "📋", label: "History"   },
  { href: "/student/biometrics", icon: "🧬", label: "Biometric" },
];

export default function StudentLayout({ children }: { children: React.ReactNode }) {
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
      if (parsed.role !== "STUDENT") { router.push("/auth/login"); return; }
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

  // Prevent SSR flash — show spinner until auth check complete
  if (!mounted || !user) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex",
        alignItems: "center", justifyContent: "center",
        background: "var(--color-bg)",
      }}>
        <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
      </div>
    );
  }

  // Get first name for the header greeting
  const firstName = user.fullName?.split(" ")[0] ?? "Student";

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-bg)", display: "flex", flexDirection: "column" }}>
      {/* ── TOP HEADER ─────────────────────────────────────── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 40,
        background: "var(--color-surface)",
        borderBottom: "1px solid var(--color-border)",
        padding: "12px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 30, height: 30,
            background: "linear-gradient(135deg, #6C63FF, #22D3EE)",
            borderRadius: 8, display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 15,
          }}>🛡️</div>
          <span style={{ fontWeight: 700, fontSize: "0.95rem", letterSpacing: "-0.01em" }}>
            Smart<span className="gradient-text">Attend</span>
          </span>
        </div>

        {/* Greeting + Sign Out */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="text-secondary" style={{ fontSize: "0.82rem" }}>
            Hi, <strong style={{ color: "var(--color-text-primary)" }}>{firstName}</strong>
          </span>
          <button
            onClick={handleSignOut}
            className="btn btn-ghost btn-sm"
            style={{ padding: "5px 12px", fontSize: "0.78rem" }}
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* ── MAIN CONTENT ───────────────────────────────────── */}
      <main style={{
        flex: 1,
        paddingBottom: 72, // space for bottom nav
        overflowY: "auto",
      }}>
        {children}
      </main>

      {/* ── BOTTOM NAVIGATION ──────────────────────────────── */}
      <nav style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
        background: "var(--color-surface)",
        borderTop: "1px solid var(--color-border)",
        display: "flex",
        paddingBottom: "env(safe-area-inset-bottom, 0px)", // iPhone notch support
      }}>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                flex: 1,
                display: "flex", flexDirection: "column", alignItems: "center",
                gap: 3, padding: "10px 0 8px",
                textDecoration: "none",
                color: isActive ? "var(--color-primary-light)" : "var(--color-text-muted)",
                transition: "color 0.2s",
                position: "relative",
              }}
            >
              {/* Active indicator bar */}
              {isActive && (
                <div style={{
                  position: "absolute", top: 0, left: "20%", right: "20%",
                  height: 2, borderRadius: "0 0 2px 2px",
                  background: "linear-gradient(90deg, #6C63FF, #22D3EE)",
                }} />
              )}
              <span style={{ fontSize: "1.3rem", lineHeight: 1 }}>{item.icon}</span>
              <span style={{ fontSize: "0.65rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
