"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  publicApi,
  type PublicLiveData,
  type PublicAgentStatus,
  type PublicTask,
  type PublicTweet,
  type PublicEmail,
  type TerminalLine,
} from "@/lib/api-client";
import { formatRelativeTime } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Elapsed-time hook (for running tasks)
// ---------------------------------------------------------------------------
function useElapsed(startIso: string | null, active: boolean): string {
  const [text, setText] = useState("");
  useEffect(() => {
    if (!active || !startIso) {
      setText("");
      return;
    }
    const tick = () => {
      const s = Math.max(0, Math.floor((Date.now() - new Date(startIso).getTime()) / 1000));
      setText(`${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startIso, active]);
  return text;
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function LivePage() {
  const [data, setData] = useState<PublicLiveData | null>(null);
  const [, setTick] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      setData(await publicApi.live());
    } catch {
      /* keep last data */
    }
  }, []);

  useEffect(() => {
    fetchData();
    const d = setInterval(fetchData, 5000);
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => {
      clearInterval(d);
      clearInterval(t);
    };
  }, [fetchData]);

  return (
    <div className="flex h-screen flex-col bg-background overflow-hidden">
      {/* ── Scrolling terminal bar ───────────────────────────────── */}
      <TerminalBar lines={data?.terminalLines ?? []} />

      {/* ── Header ───────────────────────────────────────────────── */}
      <header className="border-b border-dashed border-border bg-background shrink-0">
        <div className="flex h-12 items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Link href="/home" className="text-xl font-bold tracking-tight text-primary">
              OneraOS
            </Link>
            <span className="inline-flex items-center gap-1.5 border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              Live
            </span>
          </div>
          <Link href="/login">
            <Button size="sm">Try OneraOS &rarr;</Button>
          </Link>
        </div>
      </header>

      {/* ── 4-column dashboard ───────────────────────────────────── */}
      <div className="flex-1 grid grid-cols-12 overflow-hidden">
        {/* Col 1 — Operator status + Business stats */}
        <div className="col-span-2 border-r border-dashed border-border overflow-y-auto scrollbar-thin p-5 space-y-6">
          <OperatorColumn data={data} />
        </div>

        {/* Col 2 — Tasks */}
        <div className="col-span-4 border-r border-dashed border-border overflow-y-auto scrollbar-thin p-5">
          <TasksColumn tasks={data?.tasks ?? []} stats={data?.stats} />
        </div>

        {/* Col 3 — Twitter + Email */}
        <div className="col-span-3 border-r border-dashed border-border overflow-y-auto scrollbar-thin p-5">
          <SocialColumn
            tweets={data?.tweets ?? []}
            emails={data?.emails ?? []}
            stats={data?.stats}
          />
        </div>

        {/* Col 4 — Ask OneraOS + CTA */}
        <div className="col-span-3 overflow-y-auto scrollbar-thin p-5 flex flex-col">
          <AskColumn agents={data?.agents ?? []} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scrolling terminal bar
// ---------------------------------------------------------------------------
function TerminalBar({ lines }: { lines: TerminalLine[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [lines]);

  // Fallback lines when no real data
  const display =
    lines.length > 0
      ? lines
      : [
          { text: "Initializing Onera Operator...", status: "success", timestamp: new Date().toISOString() },
          { text: "Loading agents: planner, twitter, outreach, research", status: "success", timestamp: new Date().toISOString() },
          { text: "Agent loop scheduled: every 4 hours", status: "success", timestamp: new Date().toISOString() },
          { text: "Awaiting tasks...", status: "success", timestamp: new Date().toISOString() },
        ];

  return (
    <div
      ref={scrollRef}
      className="terminal-bar px-6 py-1.5 overflow-hidden shrink-0"
      style={{ maxHeight: 80 }}
    >
      {display.slice(-6).map((l, i) => (
        <div key={i} className="terminal-line opacity-80 truncate leading-snug">
          {l.text}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Col 1 — Operator status + stats
// ---------------------------------------------------------------------------
function OperatorColumn({ data }: { data: PublicLiveData | null }) {
  const running = data?.agents.filter((a) => a.status === "running").length ?? 0;
  const stats = data?.stats;

  return (
    <>
      {/* Operator face */}
      <div>
        <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          OneraOS
        </h3>
        <div className="border border-dashed border-border p-4 flex items-center gap-3">
          <div className="text-primary text-xs leading-none whitespace-pre font-bold shrink-0">
            {`| ^  ^ |
| ${running > 0 ? "-__-" : "o  o"} |
|______|`}
          </div>
          <div>
            <p className="text-xs font-bold text-primary">
              {running > 0 ? "Working" : "Idle"}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {running > 0
                ? `${running} agent${running > 1 ? "s" : ""} active`
                : "Waiting for next loop"}
            </p>
          </div>
        </div>
      </div>

      {/* Business stats */}
      <div>
        <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Business
        </h3>
        <div className="space-y-2">
          {[
            ["Tasks Completed", stats?.totalTasksCompleted ?? 0],
            ["Last 24h", stats?.tasksLast24h ?? 0],
            ["Emails Sent", stats?.emailsSent ?? 0],
            ["Tweets Posted", stats?.tweetsPosted ?? 0],
            ["Active Projects", stats?.activeProjects ?? 0],
          ].map(([label, value]) => (
            <div key={label as string} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{label as string}</span>
              <span className="font-bold text-primary tabular-nums">
                {(value as number).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Agent roster */}
      {data && data.agents.length > 0 && (
        <div>
          <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Agents
          </h3>
          <div className="space-y-1.5">
            {data.agents.map((agent) => {
              const isRunning = agent.status === "running";
              const isError = agent.status === "error";
              return (
                <div key={agent.name} className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={`text-[10px] shrink-0 ${
                        isRunning
                          ? "text-primary animate-pulse"
                          : isError
                            ? "text-destructive"
                            : "text-muted-foreground"
                      }`}
                    >
                      {isRunning ? "●" : isError ? "✕" : "○"}
                    </span>
                    <span
                      className={`text-[10px] truncate ${
                        isRunning ? "text-foreground font-semibold" : "text-muted-foreground"
                      }`}
                    >
                      {agent.displayName}
                    </span>
                  </div>
                  <span className="text-[9px] text-muted-foreground/60 shrink-0 tabular-nums">
                    {agent.tasksCompleted > 0
                      ? `${agent.tasksCompleted}✓`
                      : agent.lastRunAt
                        ? formatRelativeTime(agent.lastRunAt)
                        : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Col 2 — Tasks
// ---------------------------------------------------------------------------
const CATEGORY_COLORS: Record<string, string> = {
  TWITTER: "text-sky-600 border-sky-500/30 bg-sky-500/5",
  OUTREACH: "text-violet-600 border-violet-500/30 bg-violet-500/5",
  RESEARCH: "text-amber-600 border-amber-500/30 bg-amber-500/5",
  ENGINEERING: "text-emerald-600 border-emerald-500/30 bg-emerald-500/5",
  GROWTH: "text-primary border-primary/30 bg-primary/5",
  MARKETING: "text-pink-600 border-pink-500/30 bg-pink-500/5",
  ANALYTICS: "text-orange-600 border-orange-500/30 bg-orange-500/5",
  OPERATIONS: "text-muted-foreground border-border",
  PRODUCT: "text-blue-600 border-blue-500/30 bg-blue-500/5",
};

function TasksColumn({
  tasks,
  stats,
}: {
  tasks: PublicTask[];
  stats?: PublicLiveData["stats"];
}) {
  const runningTasks = tasks.filter((t) => t.status === "IN_PROGRESS");
  const completedTasks = tasks.filter((t) => t.status !== "IN_PROGRESS");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Tasks
        </h3>
        {runningTasks.length > 0 && (
          <span className="text-[10px] text-primary font-mono animate-pulse">
            {runningTasks.length} running
          </span>
        )}
      </div>

      {/* Running tasks — highlighted */}
      {runningTasks.map((task) => (
        <RunningTaskCard key={task.id} task={task} />
      ))}

      {/* Recent completed tasks */}
      {completedTasks.slice(0, 8).map((task) => (
        <TaskCard key={task.id} task={task} />
      ))}

      {tasks.length === 0 && (
        <div className="border border-dashed border-border p-8 text-center">
          <p className="text-xs text-muted-foreground">
            No recent activity. Agents are warming up...
          </p>
          <span className="text-[10px] text-primary animate-pulse block mt-2">
            Waiting for tasks
          </span>
        </div>
      )}

      {stats && stats.tasksLast24h > 0 && (
        <div className="text-[10px] text-muted-foreground pt-1 border-t border-dashed border-border/50">
          + {stats.tasksLast24h.toLocaleString()} tasks completed in the past 24h
        </div>
      )}
    </div>
  );
}

function RunningTaskCard({ task }: { task: PublicTask }) {
  const elapsed = useElapsed(task.updatedAt, true);
  const catColor = CATEGORY_COLORS[task.category] ?? "text-muted-foreground border-border";

  return (
    <div className="border-2 border-primary/40 bg-primary/5 p-4 space-y-2">
      <div className="flex items-center gap-2 mb-1">
        <span className="h-2 w-2 rounded-full bg-primary animate-pulse shrink-0" />
        <h4 className="font-bold text-sm leading-tight flex-1">{task.title}</h4>
      </div>
      {task.description && (
        <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-3">
          {task.description}
        </p>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-[9px] font-mono uppercase px-1.5 py-0.5 border ${catColor}`}>
          {task.category}
        </span>
        <span className="text-[10px] text-primary font-semibold">
          Running for {elapsed || "0m 00s"}
        </span>
      </div>
    </div>
  );
}

function TaskCard({ task }: { task: PublicTask }) {
  const catColor = CATEGORY_COLORS[task.category] ?? "text-muted-foreground border-border";
  const isFailed = task.status === "FAILED";

  return (
    <div className="border border-dashed border-border p-3 space-y-2">
      <h4 className="font-semibold text-xs leading-tight">{task.title}</h4>
      {task.description && (
        <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2">
          {task.description}
        </p>
      )}
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
        <span className={`text-[9px] font-mono uppercase px-1.5 py-0.5 border ${catColor}`}>
          {task.category}
        </span>
        <span className={isFailed ? "text-destructive" : ""}>
          {task.status === "COMPLETED" ? "✓" : "✕"} {task.status.toLowerCase()}
        </span>
        {task.agentName && <span>· {task.agentName}</span>}
        <span className="ml-auto">{formatRelativeTime(task.updatedAt)}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Col 3 — Twitter + Email
// ---------------------------------------------------------------------------
function SocialColumn({
  tweets,
  emails,
  stats,
}: {
  tweets: PublicTweet[];
  emails: PublicEmail[];
  stats?: PublicLiveData["stats"];
}) {
  return (
    <div className="space-y-5">
      {/* Twitter */}
      <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        Twitter
      </h3>

      {tweets.length > 0 ? (
        <div className="space-y-2">
          {tweets.map((tweet, i) => (
            <div key={i} className="border border-dashed border-border p-3 space-y-2">
              <p className="text-xs leading-relaxed">{tweet.text}</p>
              <span className="text-[10px] text-muted-foreground">
                {formatRelativeTime(tweet.postedAt)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="border border-dashed border-border p-4 text-center">
          <p className="text-xs text-muted-foreground">
            No tweets yet. The AI composes tweets automatically.
          </p>
        </div>
      )}

      {stats && (
        <div className="text-[10px] text-muted-foreground">
          + {stats.tweetsPosted.toLocaleString()} tweets posted all-time
        </div>
      )}

      <div className="border-t border-dashed border-border" />

      {/* Email */}
      <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        Email
      </h3>

      {emails.length > 0 ? (
        <div className="space-y-0">
          {emails.map((email, i) => (
            <div
              key={i}
              className="flex items-start gap-2 text-xs py-2.5 border-b border-dashed border-border/50 last:border-0"
            >
              <span className="text-primary font-bold shrink-0 mt-0.5">&rarr;</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate">{email.subject}</p>
                <p className="text-[10px] text-muted-foreground truncate">To: {email.to}</p>
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0">
                {formatRelativeTime(email.sentAt)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="border border-dashed border-border p-4 text-center">
          <p className="text-xs text-muted-foreground">
            No emails sent yet. The AI finds leads and sends outreach.
          </p>
        </div>
      )}

      {stats && (
        <div className="text-[10px] text-muted-foreground">
          + {stats.emailsSent.toLocaleString()} emails sent all-time
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Col 4 — Ask OneraOS + CTA
// ---------------------------------------------------------------------------
interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

function AskColumn({ agents }: { agents: PublicAgentStatus[] }) {
  const totalTasks = agents.reduce((sum, a) => sum + a.tasksCompleted, 0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleAsk = useCallback(async () => {
    const q = input.trim();
    if (!q || loading) return;

    setInput("");
    setError(null);
    setMessages((prev) => [...prev, { role: "user", text: q }]);
    setLoading(true);

    try {
      const res = await publicApi.ask(q);
      setMessages((prev) => [...prev, { role: "assistant", text: res.answer }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [input, loading]);

  const suggestions = [
    "What are you working on right now?",
    "How many tasks have you completed today?",
    "Which agents are active?",
  ];

  return (
    <>
      {/* Header */}
      <div className="shrink-0 mb-4">
        <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Ask OneraOS
        </h3>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Ask anything about what the system is doing right now.
        </p>
      </div>

      {/* Chat messages area */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin space-y-3 mb-4">
        {messages.length === 0 && (
          <div className="space-y-2">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setInput(s);
                  // auto-submit
                  setMessages((prev) => [...prev, { role: "user", text: s }]);
                  setLoading(true);
                  setError(null);
                  publicApi
                    .ask(s)
                    .then((res) =>
                      setMessages((prev) => [...prev, { role: "assistant", text: res.answer }])
                    )
                    .catch((err) =>
                      setError(err instanceof Error ? err.message : "Something went wrong")
                    )
                    .finally(() => {
                      setLoading(false);
                      setInput("");
                    });
                }}
                className="block w-full text-left text-[11px] text-muted-foreground hover:text-primary border border-dashed border-border hover:border-primary/40 p-2.5 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`text-xs leading-relaxed ${
              msg.role === "user"
                ? "text-muted-foreground"
                : "text-foreground border-l-2 border-primary pl-3"
            }`}
          >
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60 block mb-0.5">
              {msg.role === "user" ? "You" : "OneraOS"}
            </span>
            {msg.text}
          </div>
        ))}

        {loading && (
          <div className="text-xs text-primary animate-pulse">
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60 block mb-0.5">
              OneraOS
            </span>
            Thinking...
          </div>
        )}

        {error && (
          <div className="text-xs text-destructive">
            {error}
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 mb-5">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAsk()}
            placeholder="Ask anything..."
            disabled={loading}
            className="flex-1 bg-transparent border border-dashed border-border px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 disabled:opacity-50"
          />
          <button
            onClick={handleAsk}
            disabled={loading || !input.trim()}
            className="shrink-0 border border-dashed border-border px-3 py-2 text-xs text-primary hover:bg-primary/5 disabled:opacity-30 transition-colors"
          >
            Ask
          </button>
        </div>
      </div>

      {/* Stats + CTA */}
      {totalTasks > 0 && (
        <div className="shrink-0 border border-dashed border-border p-3 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Total tasks completed
            </span>
            <span className="text-lg font-bold text-primary tabular-nums">
              {totalTasks.toLocaleString()}
            </span>
          </div>
        </div>
      )}

      <div className="shrink-0 border border-dashed border-border p-4">
        <p className="text-xs font-bold text-primary mb-1">Your own AI operator.</p>
        <p className="text-[10px] text-muted-foreground mb-3 leading-relaxed">
          100 free credits. No card required. OneraOS starts working in minutes.
        </p>
        <Link href="/login">
          <Button size="sm" className="w-full">
            Get Started &rarr;
          </Button>
        </Link>
      </div>
    </>
  );
}
