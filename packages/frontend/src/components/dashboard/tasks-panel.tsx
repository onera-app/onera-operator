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

function parseResult(result: string | null): string | null {
  if (!result) return null;
  try {
    const r = JSON.parse(result) as Record<string, unknown>;
    if (typeof r.error === "string") return `Error: ${r.error}`;
    if (typeof r.text === "string" && r.text.length > 0) return r.text;
    return JSON.stringify(r, null, 2);
  } catch {
    return result;
  }
}

function ExpandedDetail({ task }: { task: Task }) {
  const parsedResult = parseResult(task.result);
  return (
    <div className="mt-2 border-t border-dashed border-border/50 pt-2">
      {parsedResult ? (
        <>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 font-semibold">
            Result
          </p>
          <p className="text-[10px] leading-relaxed text-foreground/80 line-clamp-8 whitespace-pre-wrap">
            {parsedResult}
          </p>
        </>
      ) : (
        <p className="text-[10px] text-muted-foreground italic">
          {task.status === "PENDING"
            ? "Waiting to be executed..."
            : task.status === "IN_PROGRESS"
              ? "Agent is working on this..."
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
      className="border-2 border-primary/40 bg-primary/5 p-4 space-y-2 cursor-pointer transition-colors"
      onClick={onSelect}
    >
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
        <CategoryPill category={task.category} />
        <span className="text-[10px] text-primary font-semibold">
          Running for {elapsed || "0m 0s"}
        </span>
        {task.agentName && (
          <span className="text-[10px] text-muted-foreground">· {task.agentName}</span>
        )}
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
  return (
    <div
      className="border border-destructive/40 bg-destructive/5 p-4 space-y-2 cursor-pointer transition-colors hover:border-destructive/60"
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-destructive text-xs shrink-0">✕</span>
          <h4 className="font-bold text-sm leading-tight text-foreground truncate">
            {task.title}
          </h4>
        </div>
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
      {task.description && (
        <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
          {task.description}
        </p>
      )}
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
        <CategoryPill category={task.category} />
        <span className="text-destructive font-medium">failed</span>
        {task.agentName && <span>· {task.agentName}</span>}
        <span className="ml-auto">{formatRelativeTime(task.updatedAt)}</span>
      </div>
      {executeError && (
        <p className="text-[11px] text-destructive font-medium">{executeError}</p>
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
  const canExecute = task.status === "PENDING" && !!task.agentName;

  return (
    <div
      className={`border border-dashed p-4 space-y-2 cursor-pointer transition-colors ${
        isSelected
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/50"
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-semibold text-xs leading-tight flex-1">
          {task.title}
        </h4>
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
            Do it now
          </Button>
        )}
      </div>
      {task.description && (
        <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2">
          {task.description}
        </p>
      )}
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
        <CategoryPill category={task.category} />
        <span className={isCompleted ? "" : ""}>
          {isCompleted ? "✓ completed" : task.status.toLowerCase()}
        </span>
        {task.agentName && <span>· {task.agentName}</span>}
        <span className="ml-auto">{formatRelativeTime(task.updatedAt)}</span>
      </div>
      {executeError && (
        <p className="text-[11px] text-destructive font-medium">{executeError}</p>
      )}
      {isSelected && <ExpandedDetail task={task} />}
    </div>
  );
}
