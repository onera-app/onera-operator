import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Chat stream status parsing ──────────────────────────────────────────────
// The backend interleaves %%STATUS%%{...}%%END%% markers in the text stream
// so the frontend can show live "thinking" updates while tool calls run.

const STATUS_RE = /%%STATUS%%(.*?)%%END%%\n?/g;

export interface ChatSource {
  title: string;
  url: string;
}

export interface ChatStatus {
  type: "tool-call" | "tool-result";
  tool: string;
  sources?: ChatSource[];
}

/** Human-friendly labels for tool names */
const TOOL_LABELS: Record<string, string> = {
  webSearch: "Searching the web",
  webScraper: "Reading page",
  generateEmail: "Drafting email",
  sendEmail: "Sending email",
  generateTweet: "Writing tweet",
  scheduleTweet: "Scheduling tweet",
  findLeads: "Finding leads",
  competitorResearch: "Researching competitors",
  summarizeContent: "Summarizing",
  researchCompanyUrl: "Researching company",
  executeCode: "Running code",
  notifyFounder: "Notifying founder",
  listProjectTasks: "Checking tasks",
  createProjectTask: "Creating task",
  updateProjectTask: "Updating task",
  deleteProjectTask: "Deleting task",
  executeProjectTask: "Executing task",
};

/**
 * Extract status events and clean text from a raw streamed message.
 * Returns the cleaned text (markers stripped) and the latest active status.
 */
export function parseChatStream(raw: string): {
  text: string;
  statuses: ChatStatus[];
  activeLabel: string | null;
  sources: ChatSource[];
} {
  const statuses: ChatStatus[] = [];
  let match;
  STATUS_RE.lastIndex = 0;
  while ((match = STATUS_RE.exec(raw)) !== null) {
    try {
      statuses.push(JSON.parse(match[1]) as ChatStatus);
    } catch { /* skip malformed */ }
  }

  const text = raw.replace(STATUS_RE, "");

  // Determine active label: last tool-call that doesn't have a matching tool-result
  let activeLabel: string | null = null;
  const pending = new Set<string>();
  for (const s of statuses) {
    if (s.type === "tool-call") pending.add(s.tool);
    if (s.type === "tool-result") pending.delete(s.tool);
  }
  if (pending.size > 0) {
    const lastPending = [...pending].pop()!;
    activeLabel = TOOL_LABELS[lastPending] || lastPending;
  }

  // Collect all sources from webSearch tool results (in order, for [1], [2], etc.)
  const sources: ChatSource[] = [];
  for (const s of statuses) {
    if (s.type === "tool-result" && s.sources) {
      for (const src of s.sources) {
        if (src.url) sources.push(src);
      }
    }
  }

  return { text, statuses, activeLabel, sources };
}

/**
 * Replace [1], [2], etc. in text with markdown links using the sources array.
 * E.g. "[1]" becomes "[1](https://example.com)" so ReactMarkdown renders it as a link.
 */
export function injectSourceLinks(text: string, sources: ChatSource[]): string {
  if (sources.length === 0) return text;
  // Match [N] where N is a 1- or 2-digit number — but NOT already part of a markdown link [N](...)
  return text.replace(/\[(\d{1,2})\](?!\()/g, (_match, num) => {
    const index = parseInt(num, 10) - 1; // [1] → index 0
    if (index >= 0 && index < sources.length) {
      return `[${num}](${sources[index].url})`;
    }
    return _match; // leave as-is if no matching source
  });
}

export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(date);
}
