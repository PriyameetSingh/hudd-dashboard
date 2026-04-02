"use client";
import { useState, useRef, useEffect, useMemo } from "react";
import { Send, Mic, Bot, User } from "lucide-react";
import { getCurrentUser, UserRole } from "@/lib/auth";

type Message = { role: "user" | "assistant"; content: string };

function renderMd(text: string) {
  if (!text) return '';
  return text
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>')
    .replace(/\| ([^|]+) \| ([^|]+) \|/g, '<div style="display:flex;gap:24px;font-size:11px;border-bottom:1px solid var(--border);padding:3px 0"><span style="min-width:160px;color:var(--text-secondary)">$1</span><span style="color:var(--text-primary);font-weight:600">$2</span></div>');
}

export default function ConversationalAI() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const user = getCurrentUser();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const scopeLabel = useMemo(() => {
    if (!user) return "Guest";
    if (user.role === UserRole.NODAL_OFFICER || user.role === UserRole.TASU) {
      return "Assigned schemes only";
    }
    if (user.role === UserRole.VIEWER) {
      return "Read-only (all schemes)";
    }
    return "All schemes";
  }, [user]);

  const suggestedQueries = useMemo(() => {
    const base = [
      "Show me overdue action items",
      "Which schemes have lapse risk this month?",
      "Summarise KPI submissions awaiting approval",
      "Which financial entries are pending review?",
    ];
    if (user?.role === UserRole.NODAL_OFFICER) {
      return [
        "Which KPIs are pending for my schemes?",
        "Show KPI completion for PMAY-U",
        ...base,
      ];
    }
    if (user?.role === UserRole.FA) {
      return [
        "Show expenditure status for SUJALA",
        "Which entries are overdue?",
        ...base,
      ];
    }
    return base;
  }, [user]);

  const generateResponse = (query: string) => {
    const role = user?.role ?? UserRole.VIEWER;
    const prefix = `Scope: ${scopeLabel}.`;
    const lower = query.toLowerCase();
    if (lower.includes("overdue")) {
      return `${prefix}\n\nOverdue items: 4 action items and 2 financial entries require attention. Top overdue scheme: PMAY-U Sewerage (7 days).`;
    }
    if (lower.includes("kpi")) {
      return `${prefix}\n\nKPI status: 5 submissions pending review, 4 approved, 6 awaiting entry. PMAY-U has 1 pending + 1 not submitted.`;
    }
    if (lower.includes("financial")) {
      return `${prefix}\n\nFinancial status: 3 entries pending approval, 2 overdue, 2 drafts in progress. Highest utilisation: MSBY Infrastructure (58%).`;
    }
    return `${prefix}\n\nSummary: HUDD dashboard is tracking 12 verticals, 15 action items, and 10 financial entries. Ask about a scheme, KPI, or action item for more detail.`;
  };

  async function send(q?: string) {
    const query = q ?? input.trim();
    if (!query) return;
    setInput("");
    setMessages(m => [...m, { role: "user", content: query }]);
    setLoading(true);
    try {
      const response = generateResponse(query);
      setTimeout(() => {
        setMessages(m => [...m, { role: "assistant", content: response }]);
      }, 450);
    } catch (error) {
      console.error("Failed to send message:", error);
      setMessages(m => [...m, { role: "assistant", content: "Sorry, I'm having trouble connecting. Please try again later." }]);
    } finally {
      setTimeout(() => setLoading(false), 450);
    }
  }

  return (
    <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 0, height: "calc(100vh - 48px)" }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Ask NEXUS</h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Conversational intelligence — type or speak your query</p>
        <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>Current access: {scopeLabel}</p>
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, paddingBottom: 16 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", flexDirection: m.role === "user" ? "row-reverse" : "row" }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%", background: m.role === "user" ? "var(--text-primary)" : "var(--border)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              {m.role === "user" ? <User size={13} style={{ color: "var(--bg-primary)" }} /> : <Bot size={13} style={{ color: "var(--text-primary)" }} />}
            </div>
            <div style={{
              maxWidth: "78%", background: m.role === "user" ? "var(--text-primary)" : "var(--bg-card)",
              color: m.role === "user" ? "var(--bg-primary)" : "var(--text-primary)",
              border: m.role === "user" ? "none" : "1px solid var(--border)",
              borderRadius: m.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
              padding: "12px 14px", fontSize: 13, lineHeight: 1.6,
            }}
              dangerouslySetInnerHTML={{ __html: renderMd(m.content) }}
            />
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Bot size={13} />
            </div>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px 12px 12px 2px", padding: "12px 14px" }}>
              <div style={{ display: "flex", gap: 4 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--text-muted)", animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Suggested queries */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        {suggestedQueries.map(q => (
          <button
            key={q}
            onClick={() => send(q)}
            style={{
              fontSize: 11, padding: "5px 10px", background: "transparent", border: "1px solid var(--border)",
              borderRadius: 20, cursor: "pointer", color: "var(--text-muted)", transition: "all 0.15s",
            }}
          >{q}</button>
        ))}
      </div>

      {/* Input */}
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send()}
          placeholder="Ask about any scheme, ULB, budget, or action point…"
          style={{
            flex: 1, padding: "12px 16px", background: "var(--bg-card)", border: "1px solid var(--border)",
            borderRadius: 8, color: "var(--text-primary)", fontSize: 13, outline: "none",
          }}
        />
        <button
          onClick={() => send()}
          disabled={!input.trim()}
          style={{
            padding: "0 18px", background: "var(--text-primary)", color: "var(--bg-primary)", border: "none",
            borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
            opacity: input.trim() ? 1 : 0.4,
          }}
        >
          <Send size={14} />
        </button>
        <button
          style={{ padding: "0 14px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer", color: "var(--text-muted)" }}
          title="Voice input"
        >
          <Mic size={14} />
        </button>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:0.3;transform:scale(0.9)} 50%{opacity:1;transform:scale(1.1)} }
      `}</style>
    </div>
  );
}
