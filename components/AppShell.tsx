"use client";

import { Bell, User, Bot } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { useTheme } from "@/components/ThemeProvider";
import TextSizeToolbarControl from "@/components/TextSizeToolbarControl";
import { getCurrentUser, UserRole } from "@/lib/auth";
import ConversationalAI from "@/components/ConversationalAI";

interface Props {
  children: React.ReactNode;
  title?: string;
}

export default function AppShell({ children, title }: Props) {
  const { mounted } = useTheme();
  const [user, setUser] = useState<ReturnType<typeof getCurrentUser>>(null);
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    setUser(getCurrentUser());
  }, []);

  const topLabel = useMemo(() => {
    if (!user) return "HUDD";
    return `${user.name.split(" ")[0]} — ${user.role.replace("_", " ")}`;
  }, [user]);

  const isViewer = user?.role === UserRole.VIEWER;

  const nowLabel = useMemo(() => {
    const now = new Date();
    return now.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Kolkata",
      timeZoneName: "short",
    });
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-primary)]">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <header className="border-b border-[var(--border)] bg-[var(--bg-surface)] px-6 py-4 flex items-center justify-between gap-6">
          <div>
            {/* <p className="text-[10px] uppercase tracking-[0.5em] text-[var(--text-muted)]">Government of Odisha</p> */}
            <p className="text-lg font-medium text-[var(--sidebar-text-primary)]">Housing & Urban Development Department</p>
            {/* {title && <p className="text-sm text-[var(--text-muted)]">{title} xxcc</p>} */}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-4 text-sm text-[var(--text-on-dark-muted)]">
            <TextSizeToolbarControl />
            <button
              className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-[var(--text-secondary)]"
              onClick={() => setChatOpen(true)}
              type="button"
            >
              <Bot size={14} /> Urban Assistant
            </button>
            {/* <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[var(--alert-success)]" />
              Live
            </div> */}
            <span>{mounted ? nowLabel : ""}</span>
            <button className="relative text-[var(--text-on-dark-muted)]" aria-label="Notifications" type="button">
              <Bell size={18} />
              <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-[var(--alert-critical)]" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[var(--border)] flex items-center justify-center">
                <User size={16} className="text-[var(--text-secondary)]" />
              </div>
            </div>
          </div>
        </header>
        <main className="relative flex-1 overflow-y-auto">
          {isViewer && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
              <div className="text-[80px] font-bold uppercase tracking-[0.6em] text-[var(--text-muted)] opacity-10 rotate-[-12deg]">
                Read Only
              </div>
            </div>
          )}
          <div className="relative z-20">{children}</div>
        </main>
      </div>
      {chatOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
          <div className="relative h-full w-full max-w-4xl rounded-3xl border border-[var(--border)] bg-[var(--bg-card)] shadow-2xl">
            <button
              className="absolute right-4 top-4 rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-[var(--text-muted)]"
              onClick={() => setChatOpen(false)}
              type="button"
            >
              Close
            </button>
            <ConversationalAI />
          </div>
        </div>
      )}
    </div>
  );
}
