"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { publicApi, type PublicLiveData } from "@/lib/api-client";

export default function LandingPage() {
  const [liveData, setLiveData] = useState<PublicLiveData | null>(null);

  const fetchLive = useCallback(async () => {
    try {
      setLiveData(await publicApi.live());
    } catch {
      /* keep last */
    }
  }, []);

  useEffect(() => {
    fetchLive();
    const id = setInterval(fetchLive, 8000);
    return () => clearInterval(id);
  }, [fetchLive]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background bp-texture">
      {/* Live terminal bar — always visible at the very top */}
      <LiveTerminalBar liveData={liveData} />

      {/* Header */}
      <header className="flex shrink-0 items-center justify-between border-b-2 border-dashed border-border bg-background/90 px-8 py-4 relative z-10 backdrop-blur-sm">
        <span className="font-serif text-3xl font-extrabold tracking-tight text-primary">
          Onera Operator
        </span>
        <div className="flex items-center gap-4">
          <Link
            href="/live"
            className="text-xs text-muted-foreground hover:text-primary transition-colors uppercase tracking-wider font-mono"
          >
            Live
          </Link>
          <Link
            href="https://github.com/anomalyco/onera-operator"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-primary transition-colors uppercase tracking-wider font-mono"
          >
            GitHub
          </Link>
          <Link href="/login">
            <Button variant="outline" size="sm">
              Login &rsaquo;
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-16 scrollbar-thin">
        <div className="mx-auto max-w-3xl">
          {/* Blueprint tag */}
          <div className="inline-flex items-center gap-2 border-2 border-primary bg-primary text-primary-foreground px-3 py-1 text-[10px] uppercase tracking-[0.2em] font-bold font-mono mb-8">
            <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground animate-pulse" />
            Open Source AI Operator
          </div>

          <h1 className="font-serif text-5xl font-extrabold leading-[1.08] tracking-tight text-primary sm:text-6xl">
            Your Startup&apos;s
            <br />
            Autonomous
            <br />
            Growth Engine.
          </h1>

          <p className="mt-8 text-sm leading-relaxed text-muted-foreground max-w-xl">
            Give it your company URL. Every 4 hours, it plans growth tasks,
            finds leads, sends cold emails, posts to Twitter, and files a
            daily report &mdash; all without you touching a thing.
          </p>

          {/* Live stats strip */}
          {liveData && liveData.hasRealData && (
            <div className="mt-8 flex items-center gap-6 text-xs font-mono">
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                <span className="text-muted-foreground">
                  <span className="font-bold text-primary tabular-nums">
                    {liveData.stats.totalTasksCompleted.toLocaleString()}
                  </span>{" "}
                  tasks completed
                </span>
              </div>
              {liveData.agents.filter((a) => a.status === "running").length > 0 ? (
                <div className="text-muted-foreground">
                  <span className="font-bold text-primary tabular-nums">
                    {liveData.agents.filter((a) => a.status === "running").length}
                  </span>{" "}
                  agent{liveData.agents.filter((a) => a.status === "running").length > 1 ? "s" : ""} running
                </div>
              ) : (
                <div className="text-muted-foreground">
                  <span className="font-bold text-primary tabular-nums">
                    {liveData.agents.length}
                  </span>{" "}
                  agents online
                </div>
              )}
              {liveData.stats.tasksLast24h > 0 && (
                <div className="text-muted-foreground">
                  <span className="font-bold text-primary tabular-nums">
                    {liveData.stats.tasksLast24h}
                  </span>{" "}
                  in last 24 h
                </div>
              )}
            </div>
          )}

          {/* Feature grid */}
          <div className="mt-10 grid grid-cols-3 gap-4 max-w-xl">
            <div className="border border-dashed border-border p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono mb-1">
                Outreach
              </p>
              <p className="text-xs font-semibold text-primary">
                Finds leads by role, writes personalized cold emails, posts tweets on schedule
              </p>
            </div>
            <div className="border border-dashed border-border p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono mb-1">
                Research
              </p>
              <p className="text-xs font-semibold text-primary">
                Crawls competitor sites, analyzes product positioning, surfaces market gaps
              </p>
            </div>
            <div className="border border-dashed border-border p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono mb-1">
                Ops
              </p>
              <p className="text-xs font-semibold text-primary">
                Plans tasks every 4 h, executes autonomously, delivers daily summary reports
              </p>
            </div>
          </div>

          <div className="mt-10 flex items-center gap-4">
            <Button asChild size="lg">
              <Link href="/login">Get Started &rarr;</Link>
            </Button>
            <Link
              href="/live"
              className="text-xs text-muted-foreground hover:text-primary transition-colors underline underline-offset-4"
            >
              Watch it live &rsaquo;
            </Link>
          </div>
          <p className="mt-3 text-[10px] text-muted-foreground font-mono">
            No credit card &middot; 100 free credits
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 shrink-0 border-t-2 border-dashed border-border py-4 px-8">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground uppercase tracking-wider font-mono">
          <span>Onera Operator &middot; Open Source</span>
          <div className="flex items-center gap-6">
            <a
              href="https://github.com/anomalyco/onera-operator"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary transition-colors"
            >
              GitHub
            </a>
            <a
              href="https://x.com/onerachat"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary transition-colors"
            >
              Twitter
            </a>
            <a
              href="mailto:contact@onera.chat"
              className="hover:text-primary transition-colors"
            >
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Live terminal bar — vertical multi-line, same style as /live and dashboard
// ---------------------------------------------------------------------------
function LiveTerminalBar({ liveData }: { liveData: PublicLiveData | null }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [liveData]);

  // Build display lines from live data
  const lines: string[] = [];

  if (liveData) {
    for (const t of liveData.tasks.filter((t) => t.status === "IN_PROGRESS").slice(0, 2)) {
      lines.push(`Running: ${t.title}`);
    }
    for (const l of liveData.terminalLines.slice(0, 4)) {
      lines.push(l.text);
    }
    for (const t of liveData.tasks.filter((t) => t.status === "COMPLETED").slice(0, 2)) {
      lines.push(`Done: ${t.title}`);
    }
  }

  const display =
    lines.length > 0
      ? lines
      : [
          "Initializing Onera Operator...",
          "Agents online: planner, twitter, outreach, research",
          "Agent loop scheduled: every 4 hours",
          "System ready. Awaiting company setup",
        ];

  return (
    <div
      ref={scrollRef}
      className="terminal-bar px-6 py-1.5 overflow-hidden shrink-0 relative z-10"
      style={{ maxHeight: 80 }}
    >
      {display.slice(-6).map((line, i) => (
        <div key={i} className="terminal-line opacity-80 truncate leading-snug">
          {line}
        </div>
      ))}
    </div>
  );
}
