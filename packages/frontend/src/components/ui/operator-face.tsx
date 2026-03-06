"use client";

import { useEffect, useState } from "react";

// ─── Operator moods ──────────────────────────────────────────────
// Each mood has multiple frames for subtle animation

type OperatorMood = "idle" | "thinking" | "working" | "researching" | "sending" | "done" | "error";

interface MoodConfig {
  frames: string[];
  label: string;
  description: string;
}

const MOODS: Record<OperatorMood, MoodConfig> = {
  idle: {
    frames: [
      "┌─────────┐\n│  ◠   ◠  │\n│    ▽    │\n│   ───   │\n└─────────┘",
      "┌─────────┐\n│  ◠   ◠  │\n│    ▽    │\n│   ───   │\n└─────────┘",
      "┌─────────┐\n│  ─   ─  │\n│    ▽    │\n│   ───   │\n└─────────┘",
    ],
    label: "Standing By",
    description: "Waiting for next scheduled loop",
  },
  thinking: {
    frames: [
      "┌─────────┐\n│  ◉   ◉  │\n│    ▽    │\n│   ···   │\n└─────────┘",
      "┌─────────┐\n│  ◉   ◉  │\n│    ▽    │\n│   ·◦·   │\n└─────────┘",
      "┌─────────┐\n│  ◎   ◎  │\n│    ▽    │\n│   ◦·◦   │\n└─────────┘",
    ],
    label: "Planning",
    description: "Analyzing context, generating tasks",
  },
  working: {
    frames: [
      "┌─────────┐\n│  ⊙   ⊙  │\n│    ▽    │\n│   ◡◡◡   │\n└─────────┘",
      "┌─────────┐\n│  ⊙═══⊙  │\n│    ▽    │\n│   ◡◡◡   │\n└─────────┘",
      "┌─────────┐\n│  ●   ●  │\n│    ▽    │\n│   ◡◡◡   │\n└─────────┘",
    ],
    label: "Executing",
    description: "Running tasks autonomously",
  },
  researching: {
    frames: [
      "┌─────────┐  🔍",
      "│  ◉   ◉  │ /",
      "│    ▽    │/",
      "│   ───   │",
      "└─────────┘",
    ].join("\n") === "" ? [] : [
      "┌─────────┐ 🔍\n│  ◉   ◉  │ /\n│    ▽    │/\n│   ───   │\n└─────────┘",
      "┌─────────┐🔍\n│  ◉   ◉  │/\n│    ▽    │\n│   ───   │\n└─────────┘",
      "┌─────────┐  🔍\n│  ◉   ◉  │  |\n│    ▽    │ /\n│   ───   │\n└─────────┘",
    ],
    label: "Research Mode",
    description: "Crawling the web, analyzing competitors",
  },
  sending: {
    frames: [
      "┌─────────┐\n│  ^   ^  │  ✉→\n│    ▽    │\n│   ◡◡◡   │\n└─────────┘",
      "┌─────────┐\n│  ^   ^  │   ✉→→\n│    ▽    │\n│   ◡◡◡   │\n└─────────┘",
      "┌─────────┐\n│  ^   ^  │    ✉→→→\n│    ▽    │\n│   ◡◡◡   │\n└─────────┘",
    ],
    label: "Outreach",
    description: "Finding leads, sending cold emails",
  },
  done: {
    frames: [
      "┌─────────┐\n│  ◠   ◠  │\n│    ▽    │\n│  ╰───╯  │\n└─────────┘",
    ],
    label: "Cycle Complete",
    description: "All tasks finished, resting until next loop",
  },
  error: {
    frames: [
      "┌─────────┐\n│  ✕   ✕  │\n│    ▽    │\n│   ~~~   │\n└─────────┘",
      "┌─────────┐\n│  ✕   ✕  │\n│    ▽    │\n│   ≈≈≈   │\n└─────────┘",
    ],
    label: "Issue Detected",
    description: "Something went wrong, retrying",
  },
};

// Map agent event types to moods
export function eventToMood(
  agentName?: string,
  eventType?: string
): OperatorMood {
  if (!eventType && !agentName) return "idle";

  if (eventType === "failed") return "error";
  if (eventType === "completed") return "done";

  if (agentName) {
    const name = agentName.toLowerCase();
    if (name === "planner") return "thinking";
    if (name === "research") return "researching";
    if (name === "outreach") return "sending";
    if (name === "twitter") return "working";
    if (name === "engineer") return "working";
  }

  if (eventType === "thinking") return "thinking";
  if (eventType === "tool_call" || eventType === "tool_result") return "working";
  if (eventType === "started") return "working";

  return "working";
}

interface OperatorFaceProps {
  mood?: OperatorMood;
  className?: string;
}

export function OperatorFace({ mood = "idle", className }: OperatorFaceProps) {
  const [frameIndex, setFrameIndex] = useState(0);
  const config = MOODS[mood];

  useEffect(() => {
    if (config.frames.length <= 1) {
      setFrameIndex(0);
      return;
    }
    setFrameIndex(0);
    const interval = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % config.frames.length);
    }, mood === "idle" ? 3000 : 800);
    return () => clearInterval(interval);
  }, [mood, config.frames.length]);

  return (
    <div className={className}>
      <div className="border border-dashed border-border p-4 flex items-center gap-4">
        <pre className="text-primary text-xs leading-none font-mono font-bold shrink-0 select-none">
          {config.frames[frameIndex]}
        </pre>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {mood !== "idle" && mood !== "done" && (
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse shrink-0" />
            )}
            {mood === "done" && (
              <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
            )}
            {mood === "error" && (
              <span className="h-2 w-2 rounded-full bg-destructive shrink-0" />
            )}
            {mood === "idle" && (
              <span className="h-2 w-2 rounded-full bg-muted-foreground/40 shrink-0" />
            )}
            <p className="text-sm font-bold text-foreground">{config.label}</p>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
            {config.description}
          </p>
        </div>
      </div>
    </div>
  );
}
