"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { publicApi } from "@/lib/api-client";
import type { PublicLiveData } from "@/lib/api-client";

export default function LandingPage() {
  const [liveData, setLiveData] = useState < PublicLiveData | null > (null);

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
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background bp-texture">
      {/* Live terminal bar — always visible at the very top */}
      <LiveTerminalBar liveData={liveData} />

      {/* Top Banner (Orange Watch it live) */}
      <TopLiveBanner liveData={liveData} />

      {/* Hero */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6">
        <div className="mx-auto max-w-[850px] w-full flex flex-col justify-center pb-[10vh]">

          {/* Blueprint tag */}
          <div className="inline-flex items-center gap-2 border-2 border-primary bg-primary text-primary-foreground px-3 py-1 text-[10px] uppercase tracking-[0.2em] font-bold font-mono mb-6 w-fit">
            <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground animate-pulse" />
            Onera Operator &mdash; Open Source AI
          </div>

          <h1 className="font-serif text-[2.75rem] leading-[1.08] tracking-tight text-primary sm:text-5xl md:text-[3.75rem] mb-6 text-left font-extrabold">
            Your Startup's Autonomous Growth Engine.
          </h1>

          <p className="text-[1.1rem] leading-[1.6] text-muted-foreground mb-10 max-w-[700px] pr-8 text-left font-sans">
            Give it your company URL. Every 4 hours, it plans growth tasks, finds leads, sends cold emails, posts to Twitter, and files a daily report — all without you touching a thing.
          </p>

          <div className="flex flex-col items-start gap-4">
            <div className="flex items-center gap-4">
              <Button
                asChild
                className="rounded-sm h-[48px] px-8 shadow-sm bg-primary border-2 border-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground transition-all font-sans font-bold text-[15px]"
              >
                <Link href="/login">Get Started</Link>
              </Button>
              <Link
                href="/live"
                className="text-xs text-muted-foreground hover:text-primary transition-colors underline underline-offset-4 uppercase tracking-wider font-mono font-medium"
              >
                Watch it live &rsaquo;
              </Link>
            </div>
            <p className="text-[12px] text-muted-foreground font-mono uppercase tracking-wider">
              No credit card required &middot; Free to start
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <div className="w-full px-6 pb-12 flex justify-center shrink-0 relative z-10">
        <footer className="w-full max-w-[850px] border-t-2 border-dashed border-border pt-6 flex items-center justify-start">
          <div className="flex items-center gap-6 text-[11px] text-muted-foreground font-mono uppercase tracking-wider">
            <Link href="https://github.com/anomalyco/onera-operator" target="_blank" className="hover:text-primary transition-colors">GitHub</Link>
            <Link href="https://x.com/onerachat" target="_blank" className="hover:text-primary transition-colors">Twitter</Link>
            <Link href="#" className="hover:text-primary transition-colors">Terms</Link>
            <span className="ml-2">
              Contact:{" "}
              <a href="mailto:contact@onera.chat" className="hover:text-primary transition-colors">
                contact@onera.chat
              </a>
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Live terminal bar — vertical multi-line, same style as /live and dashboard
// ---------------------------------------------------------------------------
function LiveTerminalBar({ liveData }: { liveData: PublicLiveData | null }) {
  const scrollRef = useRef < HTMLDivElement | null > (null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [liveData]);

  // Build display lines from live data
  const lines: string[] = [];

  if (liveData) {
    for (const t of liveData.tasks.filter((t: any) => t.status === "IN_PROGRESS").slice(0, 2)) {
      lines.push(`Running: ${t.title}`);
    }
    for (const l of liveData.terminalLines.slice(0, 4)) {
      lines.push(l.text);
    }
    for (const t of liveData.tasks.filter((t: any) => t.status === "COMPLETED").slice(0, 2)) {
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

// ---------------------------------------------------------------------------
// Top Live Banner
// ---------------------------------------------------------------------------
function TopLiveBanner({ liveData }: { liveData: PublicLiveData | null }) {
  const tasksDone = liveData?.stats?.totalTasksCompleted || null;

  return (
    <Link
      href="/live"
      className="w-full bg-[#fa782a] hover:bg-[#d96522] text-white flex items-center justify-center py-[10px] text-[13px] font-bold font-mono uppercase tracking-wide transition-colors shrink-0 group relative z-20"
    >
      <span className="h-[6px] w-[6px] rounded-full bg-white group-hover:bg-white/80 transition-colors animate-pulse mr-[10px]" />
      Watch Onera work on {tasksDone ? tasksDone.toLocaleString() : "..."} tasks live &rarr;
    </Link>
  );
}
