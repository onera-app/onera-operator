"use client";

import { useEffect, useRef, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

interface AgentEvent {
  type: "step" | "thinking" | "tool_call" | "tool_result" | "started" | "completed" | "failed" | "info";
  agentName: string;
  taskId: string;
  taskTitle: string;
  projectId: string;
  message: string;
  data?: Record<string, unknown>;
  timestamp: string;
}

interface LiveFeedProps {
  projectId?: string;
}

const TYPE_ICONS: Record<string, string> = {
  started: ">",
  thinking: "~",
  tool_call: "$",
  tool_result: "<",
  completed: "+",
  failed: "!",
  step: ".",
  info: "#",
};

const TYPE_COLORS: Record<string, string> = {
  started: "text-blue-400",
  thinking: "text-muted-foreground",
  tool_call: "text-yellow-500",
  tool_result: "text-green-500",
  completed: "text-primary",
  failed: "text-destructive",
  step: "text-muted-foreground",
  info: "text-muted-foreground/60",
};

export function LiveFeed({ projectId }: LiveFeedProps) {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const maxEvents = 50;

  useEffect(() => {
    const url = new URL(`${API_BASE}/api/activity/stream`);
    if (projectId) url.searchParams.set("projectId", projectId);

    let eventSource: EventSource | null = null;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      eventSource = new EventSource(url.toString());

      eventSource.onopen = () => {
        setConnected(true);
      };

      eventSource.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data) as AgentEvent;
          setEvents((prev) => {
            const next = [...prev, event];
            return next.length > maxEvents ? next.slice(-maxEvents) : next;
          });
        } catch {
          // ignore
        }
      };

      eventSource.onerror = () => {
        setConnected(false);
        eventSource?.close();
        retryTimeout = setTimeout(connect, 3000);
      };
    }

    connect();

    return () => {
      eventSource?.close();
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [projectId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  if (events.length === 0) {
    return (
      <div className="border border-dashed border-border p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className={`h-2 w-2 rounded-full ${connected ? "bg-green-500" : "bg-muted-foreground"}`} />
          <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
            Live Feed
          </span>
        </div>
        <p className="text-xs text-muted-foreground/60 font-mono">
          Waiting for agent activity...
        </p>
      </div>
    );
  }

  return (
    <div className="border border-dashed border-border p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className={`h-2 w-2 rounded-full ${connected ? "bg-green-500 animate-pulse" : "bg-muted-foreground"}`} />
        <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
          Live Feed
        </span>
        <span className="text-[11px] text-muted-foreground/40 ml-auto">
          {events.length} events
        </span>
      </div>

      <div
        ref={scrollRef}
        className="max-h-72 overflow-y-auto space-y-1 font-mono"
      >
        {events.map((event, i) => (
          <div key={`${event.timestamp}-${i}`} className="flex gap-2 items-start">
            <span className={`text-xs shrink-0 w-3 ${TYPE_COLORS[event.type] || "text-muted-foreground"}`}>
              {TYPE_ICONS[event.type] || "."}
            </span>
            <div className="min-w-0 flex-1">
              <span className={`text-xs leading-relaxed break-words ${TYPE_COLORS[event.type] || "text-muted-foreground"}`}>
                {formatEventMessage(event)}
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground/40 shrink-0 tabular-nums">
              {formatTime(event.timestamp)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatEventMessage(event: AgentEvent): string {
  switch (event.type) {
    case "started":
      return `${event.agentName}: ${event.taskTitle}`;
    case "thinking": {
      const text = event.message || "";
      return text.length > 120 ? text.slice(0, 120) + "..." : text;
    }
    case "tool_call":
      return event.message;
    case "tool_result":
      return event.message;
    case "completed": {
      const preview = (event.data?.text as string) || "";
      const short = preview.length > 80 ? preview.slice(0, 80) + "..." : preview;
      return short ? `Done: ${short}` : `Completed: ${event.taskTitle}`;
    }
    case "failed":
      return `Failed: ${(event.data?.error as string) || event.taskTitle}`;
    default:
      return event.message;
  }
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return "";
  }
}
