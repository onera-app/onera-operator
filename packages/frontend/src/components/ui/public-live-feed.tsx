"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

// ─── Types ───────────────────────────────────────────────────────

export interface PublicStreamEvent {
  type: string;
  agentName: string;
  taskTitle: string;
  message: string;
  timestamp: string;
}

interface FeedLine {
  id: number;
  text: string;
  displayText: string;
  type: string;
  agentName: string;
  timestamp: string;
  isTyping: boolean;
}

// ─── Formatting helpers ──────────────────────────────────────────

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

function formatEventLine(event: PublicStreamEvent): string {
  switch (event.type) {
    case "started":
      return `${event.agentName} started: ${event.taskTitle}`;
    case "thinking": {
      const text = event.message || "";
      return text.length > 150 ? text.slice(0, 150) + "..." : text;
    }
    case "tool_call":
      return `${event.agentName}: ${event.message}`;
    case "tool_result":
      return `${event.agentName}: ${event.message}`;
    case "completed":
      return `${event.agentName} completed: ${event.taskTitle}`;
    case "failed":
      return `${event.agentName} failed: ${event.taskTitle}`;
    default:
      return event.message || event.taskTitle;
  }
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return "";
  }
}

// ─── Component ───────────────────────────────────────────────────

interface PublicLiveFeedProps {
  className?: string;
  maxLines?: number;
  onEvent?: (event: PublicStreamEvent) => void;
}

let lineIdCounter = 0;

export function PublicLiveFeed({
  className,
  maxLines = 80,
  onEvent,
}: PublicLiveFeedProps) {
  const [lines, setLines] = useState<FeedLine[]>([]);
  const [connected, setConnected] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimers = useRef<Map<number, ReturnType<typeof setInterval>>>(new Map());

  // Auto-scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [lines]);

  // Cleanup typing timers on unmount
  useEffect(() => {
    return () => {
      typingTimers.current.forEach((timer) => clearInterval(timer));
    };
  }, []);

  // Typewriter effect for a line
  const typewriteLine = useCallback(
    (line: FeedLine) => {
      const fullText = line.text;
      let charIndex = 0;
      const speed = Math.max(8, Math.min(25, 600 / fullText.length)); // adaptive speed

      const timer = setInterval(() => {
        charIndex++;
        if (charIndex >= fullText.length) {
          clearInterval(timer);
          typingTimers.current.delete(line.id);
          setLines((prev) =>
            prev.map((l) =>
              l.id === line.id
                ? { ...l, displayText: fullText, isTyping: false }
                : l
            )
          );
          return;
        }
        setLines((prev) =>
          prev.map((l) =>
            l.id === line.id
              ? { ...l, displayText: fullText.slice(0, charIndex) }
              : l
          )
        );
      }, speed);

      typingTimers.current.set(line.id, timer);
    },
    []
  );

  // SSE connection
  useEffect(() => {
    const url = `${API_BASE}/api/public/stream`;
    let eventSource: EventSource | null = null;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      eventSource = new EventSource(url);

      eventSource.onopen = () => setConnected(true);

      eventSource.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data) as PublicStreamEvent;
          onEvent?.(event);

          const text = formatEventLine(event);
          const id = ++lineIdCounter;
          const newLine: FeedLine = {
            id,
            text,
            displayText: "",
            type: event.type,
            agentName: event.agentName,
            timestamp: event.timestamp,
            isTyping: true,
          };

          setLines((prev) => {
            const next = [...prev, newLine];
            return next.length > maxLines ? next.slice(-maxLines) : next;
          });

          // Start typewriter
          typewriteLine(newLine);
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
  }, [maxLines, onEvent, typewriteLine]);

  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-3">
        <span
          className={`h-2 w-2 rounded-full ${
            connected ? "bg-green-500 animate-pulse" : "bg-muted-foreground/40"
          }`}
        />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono font-bold">
          Live Stream
        </span>
        {connected && (
          <span className="text-[9px] text-green-600 font-mono ml-auto">
            CONNECTED
          </span>
        )}
        {!connected && lines.length === 0 && (
          <span className="text-[9px] text-muted-foreground font-mono ml-auto">
            CONNECTING...
          </span>
        )}
      </div>

      <div
        ref={scrollRef}
        className="max-h-96 overflow-y-auto scrollbar-thin space-y-0.5 font-mono"
      >
        {lines.length === 0 && (
          <div className="text-xs text-muted-foreground/50 py-4 text-center">
            {connected
              ? "Waiting for agent activity..."
              : "Connecting to live stream..."}
          </div>
        )}

        {lines.map((line) => (
          <div
            key={line.id}
            className="flex gap-2 items-start py-0.5"
          >
            <span
              className={`text-[10px] shrink-0 w-3 ${
                TYPE_COLORS[line.type] || "text-muted-foreground"
              }`}
            >
              {TYPE_ICONS[line.type] || "."}
            </span>
            <span
              className={`text-[11px] leading-relaxed break-words flex-1 ${
                TYPE_COLORS[line.type] || "text-muted-foreground"
              }`}
            >
              {line.displayText}
              {line.isTyping && (
                <span className="inline-block w-1.5 h-3 bg-current ml-0.5 animate-blink align-text-bottom" />
              )}
            </span>
            <span className="text-[9px] text-muted-foreground/30 shrink-0 tabular-nums">
              {formatTime(line.timestamp)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
