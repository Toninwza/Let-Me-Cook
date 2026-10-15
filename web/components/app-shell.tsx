"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Magnet from "./magnet";
import { useAuth } from "./auth-provider";

const NAV = [
  { label: "หน้าแรก", href: "/", icon: "M4 11l8-7 8 7v9H4z" },
  { label: "Chatbot", href: "/chat", icon: "M4 5h16v11H10l-5 4v-4H4z", badge: "AI" },
];

const ShellContext = createContext<{ openMenu: () => void }>({ openMenu: () => {} });

/** Opens the mobile drawer. Pages put it in their header. */
export function useShell() {
  return useContext(ShellContext);
}

export function MenuButton({ className = "" }: { className?: string }) {
  const { openMenu } = useShell();
  return (
    <button onClick={openMenu} aria-label="เปิดเมนู" className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl md:hidden ${className}`}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <path d="M4 7h16M4 12h10M4 17h16" />
      </svg>
    </button>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const openMenu = useCallback(() => setDrawer(true), []);

  return (
    <ShellContext.Provider value={{ openMenu }}>
      <div className="flex h-dvh overflow-hidden bg-ground">
        <aside
          aria-label="เมนูหลัก"
          className={`hidden shrink-0 flex-col gap-3.5 border-r border-line bg-paper text-ink transition-[width] duration-200 md:flex ${collapsed ? "w-[76px]" : "w-[260px]"}`}
        >
          <SidebarBody collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>
      {drawer && <Drawer onClose={() => setDrawer(false)} />}
    </ShellContext.Provider>
  );
}

function SidebarBody({ collapsed, onToggle, onNavigate }: { collapsed: boolean; onToggle?: () => void; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <>
      <div className={collapsed ? "flex flex-col items-center gap-3.5 pb-1.5 pt-5" : "flex items-center justify-between pb-1.5 pl-5 pr-4 pt-5"}>
        <Link href="/" onClick={onNavigate} className="flex items-center gap-2.5 text-ink">
          <Magnet size={26} />
          {!collapsed && <span className="font-display text-xl font-extrabold">PULL</span>}
        </Link>
        {onToggle && (
          <button
            onClick={onToggle}
            aria-label={collapsed ? "ขยายเมนู" : "ย่อเมนู"}
            aria-expanded={!collapsed}
            className="flex h-9 w-9 items-center justify-center rounded-[10px] text-faint hover:bg-ground hover:text-ink"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`}>
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
        )}
      </div>

      {!collapsed && <div className="px-6 pt-1.5 text-[11.5px] font-semibold tracking-[0.08em] text-faint">เมนู</div>}

      <nav className="flex flex-col gap-1 px-3">
        {NAV.map((n) => {
          const active = pathname === n.href || pathname.startsWith(`${n.href}/`);
          return (
            <Link
              key={n.href}
              href={n.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`group relative flex items-center gap-3 rounded-[14px] ${collapsed ? "justify-center py-1.5" : "min-h-12 px-2.5 py-1.5"} ${
                active ? "bg-basil-soft text-basil-dark" : "text-ink-2 hover:bg-ground"
              }`}
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] ${active ? "bg-basil text-paper" : "bg-ground text-basil"}`}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={n.icon} />
                </svg>
              </span>
              {!collapsed && <span className={`flex-1 text-[14.5px] ${active ? "font-semibold" : "font-medium"}`}>{n.label}</span>}
              {!collapsed && n.badge && <span className="rounded-full bg-saffron px-[7px] py-px text-[10.5px] font-bold text-[#2B1C00]">{n.badge}</span>}
              {collapsed && <Tip>{n.label}</Tip>}
            </Link>
          );
        })}
      </nav>

      <div className="flex-1" />
      <UserCard collapsed={collapsed} onNavigate={onNavigate} />
    </>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <span className="pointer-events-none absolute left-[calc(100%+12px)] top-1/2 z-10 -translate-y-1/2 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-[12.5px] font-medium text-paper opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
      {children}
    </span>
  );
}

function UserCard({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const { loading, session, name, email, signOut, configured } = useAuth();
  const initial = (name ?? "ม").slice(0, 1).toUpperCase();

  if (!session) {
    return (
      <div className="px-3 pb-3.5">
        <Link
          href="/login"
          onClick={onNavigate}
          className={`group relative flex items-center gap-3 rounded-2xl border border-line hover:bg-ground ${collapsed ? "justify-center py-2" : "p-2.5 pr-3.5"}`}
        >
          <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-ground text-basil">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 3h4v18h-4M10 17l5-5-5-5M15 12H3" />
            </svg>
          </span>
          {!collapsed && (
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="text-[13.5px] font-semibold text-ink">{loading ? "กำลังตรวจสอบ" : "เข้าสู่ระบบ"}</span>
              <span className="text-[11.5px] text-muted">{configured ? "ตอนนี้ใช้เป็นผู้ใช้เดโม่" : "ใช้เป็นผู้ใช้เดโม่"}</span>
            </span>
          )}
          {collapsed && <Tip>เข้าสู่ระบบ</Tip>}
        </Link>
      </div>
    );
  }

  return (
    <div className="px-3 pb-3.5">
      <div className={`group relative flex items-center gap-2.5 rounded-2xl border border-line ${collapsed ? "justify-center py-2" : "p-2.5"}`}>
        <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-saffron font-bold text-[#2B1C00]">{initial}</span>
        {!collapsed && (
          <>
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate text-[13.5px] font-semibold text-ink">{name}</span>
              <span className="truncate text-[11.5px] text-muted">{email}</span>
            </span>
            <button onClick={signOut} aria-label="ออกจากระบบ" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-muted hover:bg-ground hover:text-ink">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 4H5v16h4M16 8l4 4-4 4M20 12H9" />
              </svg>
            </button>
          </>
        )}
        {collapsed && (
          <button onClick={signOut} aria-label="ออกจากระบบ" className="absolute inset-0 rounded-2xl">
            <Tip>{name} · ออกจากระบบ</Tip>
          </button>
        )}
      </div>
    </div>
  );
}

function Drawer({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <button aria-label="ปิดเมนู" onClick={onClose} className="absolute inset-0 bg-ink/45" />
      <aside
        aria-label="เมนูหลัก"
        className="absolute inset-y-0 left-0 flex w-[min(300px,86vw)] flex-col gap-3.5 rounded-r-[28px] bg-paper pb-[max(0.5rem,env(safe-area-inset-bottom))] text-ink shadow-[18px_0_48px_rgba(0,0,0,0.22)]"
      >
        <SidebarBody collapsed={false} onNavigate={onClose} />
        <button onClick={onClose} aria-label="ปิดเมนู" className="absolute right-3 top-4 flex h-10 w-10 items-center justify-center rounded-xl bg-ground text-muted hover:bg-line hover:text-ink">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </aside>
    </div>
  );
}
