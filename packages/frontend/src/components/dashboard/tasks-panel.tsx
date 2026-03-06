"use client";

import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, Task } from "@/lib/api-client";
import { formatDate, formatRelativeTime } from "@/lib/utils";
import { CollapsibleSection } from "@/components/ui/collapsible-section";

// ─── Category color map (matches /live page) ──────────────────────────────
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

interface OutreachEmail {
  subject: string;
  body: string;
  recipientName: string;
  recipientCompany: string;
  to: string;
  sendStatus: "sent" | "queued" | "rejected" | "failed" | "unknown";
}

function parseOutreachEmails(resultJson: string): OutreachEmail[] | null {
  try {
    const parsed = JSON.parse(resultJson);
    const toolResults: { tool: string; result: Record<string, unknown> }[] =
      parsed?.toolResults;
    if (!Array.isArray(toolResults)) return null;

    const generates = toolResults.filter((r) => r.tool === "generateEmail");
    const sends = toolResults.filter((r) => r.tool === "sendEmail");

    if (generates.length === 0) return null;

    return generates.map((gen, i) => {
      const g = gen.result;
      const subject = String(g?.subject ?? "No subject");
      const send =
        sends.find((s) => String(s.result?.subject) === subject) ?? sends[i];
      const s = send?.result;
      return {
        subject,
        body: String(g?.body ?? ""),
        recipientName: String(g?.recipientName ?? ""),
        recipientCompany: String(g?.recipientCompany ?? ""),
        to: String(s?.to ?? ""),
        sendStatus: (["sent", "queued", "rejected", "failed"].includes(
          String(s?.status)
        )
          ? String(s?.status)
          : "unknown") as OutreachEmail["sendStatus"],
      };
    });
  } catch {
    return null;
  }
}

function useElapsedTime(startIso: string | null, isRunning: boolean): string {
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    if (!isRunning || !startIso) {
      setElapsed("");
      return;
    }
    const update = () => {
      const diffMs = Date.now() - new Date(startIso).getTime();
      const totalSec = Math.floor(diffMs / 1000);
      const mins = Math.floor(totalSec / 60);
      const secs = totalSec % 60;
      setElapsed(`${mins}m ${secs}s`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [startIso, isRunning]);

  return elapsed;
}

function OutreachEmailList({ emails }: { emails: OutreachEmail[] }) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const statusStyle: Record<OutreachEmail["sendStatus"], string> = {
    sent: "text-green-600",
    queued: "text-yellow-600",
    rejected: "text-red-600",
    failed: "text-red-600",
    unknown: "text-muted-foreground",
  };

  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 font-semibold">
        Emails ({emails.length})
      </p>
      {emails.map((email, i) => {
        const isExpanded = expandedIndex === i;
        return (
          <div key={i} className="border border-dashed border-border/50">
            <button
              type="button"
              className="flex w-full items-center gap-2 px-2 py-1.5 text-left cursor-pointer hover:bg-primary/5 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setExpandedIndex(isExpanded ? null : i);
              }}
            >
              <span className="text-[10px] text-muted-foreground/50 shrink-0">
                {isExpanded ? "▼" : "▶"}
              </span>
              <span className="text-[11px] font-medium text-foreground truncate flex-1">
                {email.subject}
              </span>
              {email.to && (
                <span className="text-[10px] text-muted-foreground truncate shrink-0 max-w-[120px]">
                  {email.to}
                </span>
              )}
              <span
                className={`text-[9px] font-mono uppercase shrink-0 ${statusStyle[email.sendStatus]}`}
              >
                {email.sendStatus}
              </span>
            </button>
            {isExpanded && (
              <div className="px-3 pb-2 space-y-1.5">
                {(email.recipientName || email.recipientCompany) && (
                  <p className="text-[10px] text-muted-foreground">
                    To: {email.recipientName}
                    {email.recipientCompany
                      ? `, ${email.recipientCompany}`
                      : ""}
                  </p>
                )}
                <div className="border-t border-dashed border-border/30 pt-1.5">
                  <p className="text-[11px] leading-relaxed text-foreground/80 whitespace-pre-line">
                    {email.body}
                  </p>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface TasksPanelProps {
  projectId: string;
}

export function TasksPanel({ projectId }: TasksPanelProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [executingIds, setExecutingIds] = useState<Set<string>>(new Set());
  const [errorByTaskId, setErrorByTaskId] = useState<Record<string, string>>({});

  const fetchTasks = useCallback(async () => {
    try {
      const data = await api.tasks.list({ projectId });
      setTasks(data);
    } catch (err) {
      console.error("Failed to fetch tasks:", err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const handleExecuteTask = useCallback(
    async (taskId: string) => {
      setExecutingIds((prev) => new Set(prev).add(taskId));
      setErrorByTaskId((prev) => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
      try {
        await api.tasks.execute(taskId);
        // Re-fetch to show updated status
        fetchTasks();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to execute task";
        setErrorByTaskId((prev) => ({ ...prev, [taskId]: message }));
      } finally {
        setExecutingIds((prev) => {
          const next = new Set(prev);
          next.delete(taskId);
          return next;
        });
      }
    },
    [fetchTasks]
  );

  // Reset loading state when project changes (before new data arrives)
  useEffect(() => {
    setLoading(true);
  }, [projectId]);

  useEffect(() => {
    fetchTasks();
    // Poll every 5 seconds for live updates
    const interval = setInterval(fetchTasks, 5000);
    return () => clearInterval(interval);
  }, [fetchTasks]);

  if (loading) {
    return (
      <div className="space-y-3">
        <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Tasks
        </h3>
        <div className="flex items-center justify-center py-8">
          <span className="text-xs text-muted-foreground animate-pulse">
            Loading...
          </span>
        </div>
      </div>
    );
  }

  const since24h = Date.now() - 24 * 60 * 60 * 1000;
  const completedToday = tasks.filter(
    (t) => t.status === "COMPLETED" && t.completedAt && new Date(t.completedAt).getTime() >= since24h
  ).length;
  const runningTasks = tasks.filter((t) => t.status === "IN_PROGRESS");
  const failedTasks = tasks.filter((t) => t.status === "FAILED");
  const otherTasks = tasks.filter(
    (t) => t.status !== "IN_PROGRESS" && t.status !== "FAILED"
  );

  return (
    <CollapsibleSection
      title="Tasks"
      badge={
        runningTasks.length > 0 ? (
          <span className="text-[10px] text-primary font-mono animate-pulse">
            {runningTasks.length} running
          </span>
        ) : undefined
      }
      trailing={
        <span className="text-[10px] text-muted-foreground">
          {tasks.length} total
        </span>
      }
    >
      <div className="space-y-3 overflow-y-auto pr-1 scrollbar-thin">
        {/* Running tasks — highlighted at top */}
        {runningTasks.map((task) => (
          <RunningTaskCard
            key={task.id}
            task={task}
            isSelected={selectedTaskId === task.id}
            onSelect={() =>
              setSelectedTaskId((prev) => (prev === task.id ? null : task.id))
            }
          />
        ))}

        {/* Failed tasks — next, so user sees them */}
        {failedTasks.map((task) => (
          <FailedTaskCard
            key={task.id}
            task={task}
            isSelected={selectedTaskId === task.id}
            onSelect={() =>
              setSelectedTaskId((prev) => (prev === task.id ? null : task.id))
            }
            onExecute={handleExecuteTask}
            executeError={errorByTaskId[task.id]}
          />
        ))}

        {/* Remaining tasks */}
        {otherTasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            isSelected={selectedTaskId === task.id}
            onSelect={() =>
              setSelectedTaskId((prev) => (prev === task.id ? null : task.id))
            }
            onExecute={handleExecuteTask}
            executeError={errorByTaskId[task.id]}
          />
        ))}
        {tasks.length === 0 && (
          <div className="border border-dashed border-border p-6 text-center">
            <p className="text-xs text-muted-foreground">
              No tasks yet. The AI planner is analyzing your company...
            </p>
            <div className="mt-2">
              <span className="text-[10px] text-primary animate-pulse">
                Planning in progress
              </span>
            </div>
          </div>
        )}
      </div>
      {completedToday > 0 && (
        <div className="text-[10px] text-muted-foreground pt-1 border-t border-dashed border-border/50">
          + {completedToday} task{completedToday !== 1 ? "s" : ""} completed in the past 24h
        </div>
      )}
    </CollapsibleSection>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function getCatColor(category: string) {
  return CATEGORY_COLORS[category] ?? "text-muted-foreground border-border";
}

function CategoryPill({ category }: { category: string }) {
  return (
    <span className={`text-[9px] font-mono uppercase px-1.5 py-0.5 border ${getCatColor(category)}`}>
      {category}
    </span>
  );
}

/** Friendly agent display names */
const AGENT_LABELS: Record<string, string> = {
  outreach: "Outreach",
  twitter: "Twitter",
  research: "Research",
  engineer: "Engineering",
  planner: "Planner",
  report: "Reports",
};

function agentLabel(name: string | null): string | null {
  if (!name) return null;
  return AGENT_LABELS[name] || name.charAt(0).toUpperCase() + name.slice(1);
}

/** Extracts a human-readable summary from the task result JSON */
function parseResult(result: string | null): string | null {
  if (!result) return null;
  try {
    const r = JSON.parse(result) as Record<string, unknown>;
    if (typeof r.error === "string") return r.error;
    // The agent's text summary is the best thing to show
    if (typeof r.text === "string" && r.text.length > 0) return r.text;
    // For outreach results, summarize tool calls
    if (Array.isArray(r.toolResults)) {
      const sends = (r.toolResults as Array<{ tool: string; result: Record<string, unknown> }>)
        .filter((tr) => tr.tool === "sendEmail" && (tr.result as Record<string, unknown>)?.status === "sent");
      if (sends.length > 0) {
        const recipients = sends.map((s) => (s.result as Record<string, unknown>).to).join(", ");
        return `Sent ${sends.length} email${sends.length > 1 ? "s" : ""} to ${recipients}`;
      }
    }
    // For tweets
    if (typeof r.tweetId === "string") return "Tweet posted successfully";
    // Fallback: don't dump raw JSON
    if (typeof r.message === "string") return r.message;
    return null;
  } catch {
    // Plain text result
    return result.length > 300 ? result.substring(0, 300) + "..." : result;
  }
}

/** Truncate description to first sentence for card display */
function briefDescription(desc: string): string {
  // Take first sentence (up to period, or first 120 chars)
  const firstSentence = desc.match(/^[^.!?]+[.!?]/)?.[0];
  if (firstSentence && firstSentence.length <= 120) return firstSentence;
  if (desc.length <= 100) return desc;
  return desc.substring(0, 100) + "...";
}

function ExpandedDetail({ task }: { task: Task }) {
  const parsedResult = parseResult(task.result);
  const outreachEmails =
    task.category === "OUTREACH" && task.result
      ? parseOutreachEmails(task.result)
      : null;

  return (
    <div className="mt-2 border-t border-dashed border-border/50 pt-2 space-y-2">
      {/* Full description (only when expanded, for tasks with long prompts) */}
      {task.description.length > 120 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-0.5">
            Details
          </p>
          <p className="text-[10px] leading-relaxed text-muted-foreground line-clamp-6 whitespace-pre-wrap">
            {task.description}
          </p>
        </div>
      )}
      {outreachEmails ? (
        <OutreachEmailList emails={outreachEmails} />
      ) : parsedResult ? (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-0.5">
            Result
          </p>
          <p className="text-[10px] leading-relaxed text-foreground/80 line-clamp-8 whitespace-pre-wrap">
            {parsedResult}
          </p>
        </div>
      ) : (
        <p className="text-[10px] text-muted-foreground italic">
          {task.status === "PENDING"
            ? "Queued — waiting to run"
            : task.status === "IN_PROGRESS"
              ? "Running now..."
              : "No result recorded."}
        </p>
      )}
    </div>
  );
}

// ─── Running Task Card ────────────────────────────────────────────────────
// Bold double border, pulsing dot, live elapsed timer — stands out clearly.

function RunningTaskCard({
  task,
  isSelected,
  onSelect,
}: {
  task: Task;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const elapsed = useElapsedTime(task.updatedAt, true);

  return (
    <div
      className="border-2 border-primary/40 bg-primary/5 p-4 space-y-1.5 cursor-pointer transition-colors"
      onClick={onSelect}
    >
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-primary animate-pulse shrink-0" />
        <h4 className="font-bold text-[13px] leading-tight flex-1 truncate">{task.title}</h4>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <CategoryPill category={task.category} />
        {agentLabel(task.agentName) && (
          <span className="text-[10px] text-muted-foreground">{agentLabel(task.agentName)}</span>
        )}
        <span className="text-[10px] text-primary font-semibold ml-auto">
          {elapsed || "0s"}
        </span>
      </div>
      {isSelected && <ExpandedDetail task={task} />}
    </div>
  );
}

// ─── Failed Task Card ─────────────────────────────────────────────────────
// Red tint, destructive border, retry button prominent.

function FailedTaskCard({
  task,
  isSelected,
  onSelect,
  onExecute,
  executeError,
}: {
  task: Task;
  isSelected: boolean;
  onSelect: () => void;
  onExecute?: (taskId: string) => void;
  executeError?: string;
}) {
  const errorSummary = parseResult(task.result);

  return (
    <div
      className="border border-destructive/40 bg-destructive/5 p-4 space-y-1.5 cursor-pointer transition-colors hover:border-destructive/60"
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-semibold text-xs leading-tight text-foreground flex-1 truncate">
          {task.title}
        </h4>
        {task.agentName && (
          <Button
            onClick={(e) => {
              e.stopPropagation();
              onExecute?.(task.id);
            }}
            variant="outline"
            size="sm"
            className="h-6 shrink-0 border-dashed border-destructive/30 text-destructive hover:bg-destructive/10 px-2 py-1 text-[9px]"
          >
            Retry
          </Button>
        )}
      </div>
      {errorSummary && (
        <p className="text-[10px] text-destructive/80 line-clamp-1">{errorSummary}</p>
      )}
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
        <CategoryPill category={task.category} />
        {agentLabel(task.agentName) && (
          <span>{agentLabel(task.agentName)}</span>
        )}
        <span className="ml-auto">{formatRelativeTime(task.updatedAt)}</span>
      </div>
      {executeError && (
        <p className="text-[10px] text-destructive font-medium">{executeError}</p>
      )}
      {isSelected && <ExpandedDetail task={task} />}
    </div>
  );
}

// ─── Standard Task Card ───────────────────────────────────────────────────
// Dashed border, color-coded category pill, status indicator.

function TaskCard({
  task,
  isSelected,
  onSelect,
  onExecute,
  executeError,
}: {
  task: Task;
  isSelected: boolean;
  onSelect: () => void;
  onExecute?: (taskId: string) => void;
  executeError?: string;
}) {
  const isCompleted = task.status === "COMPLETED";
  const isPending = task.status === "PENDING";
  const canExecute = isPending && !!task.agentName;
  const resultSummary = isCompleted ? parseResult(task.result) : null;

  return (
    <div
      className={`border border-dashed p-3.5 space-y-1.5 cursor-pointer transition-colors ${
        isSelected
          ? "border-primary bg-primary/5"
          : isCompleted
            ? "border-border/60 hover:border-primary/40"
            : "border-border hover:border-primary/50"
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {isCompleted && (
            <span className="text-green-600 text-[10px] shrink-0">✓</span>
          )}
          <h4 className={`font-semibold text-xs leading-tight truncate ${
            isCompleted ? "text-muted-foreground" : "text-foreground"
          }`}>
            {task.title}
          </h4>
        </div>
        {canExecute && (
          <Button
            onClick={(e) => {
              e.stopPropagation();
              onExecute?.(task.id);
            }}
            variant="outline"
            size="sm"
            className="h-6 shrink-0 border-dashed px-2 py-1 text-[9px]"
          >
            Run
          </Button>
        )}
      </div>
      {/* For completed tasks, show result summary instead of description */}
      {isCompleted && resultSummary ? (
        <p className="text-[10px] text-muted-foreground/70 leading-relaxed line-clamp-1">
          {resultSummary}
        </p>
      ) : !isCompleted && task.description ? (
        <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-1">
          {briefDescription(task.description)}
        </p>
      ) : null}
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
        <CategoryPill category={task.category} />
        {agentLabel(task.agentName) && (
          <span>{agentLabel(task.agentName)}</span>
        )}
        {isPending && (
          <span className="text-amber-600">queued</span>
        )}
        <span className="ml-auto">{formatRelativeTime(task.updatedAt)}</span>
      </div>
      {executeError && (
        <p className="text-[10px] text-destructive font-medium">{executeError}</p>
      )}
      {isSelected && <ExpandedDetail task={task} />}
    </div>
  );
}
