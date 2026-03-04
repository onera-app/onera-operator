"use client";

import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { api, Task } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";

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
  const runningCount = tasks.filter((t) => t.status === "IN_PROGRESS").length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Tasks
        </h3>
        <div className="flex items-center gap-2">
          {runningCount > 0 && (
            <span className="text-[10px] text-yellow-600 font-mono animate-pulse">
              {runningCount} running
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">
            {tasks.length} total
          </span>
        </div>
      </div>

      <div className="space-y-3 overflow-y-auto max-h-[700px] pr-1 scrollbar-thin">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            isSelected={selectedTaskId === task.id}
            onSelect={() =>
              setSelectedTaskId((prev) => (prev === task.id ? null : task.id))
            }
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
    </div>
  );
}

function TaskCard({
  task,
  isSelected,
  onSelect,
}: {
  task: Task;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const isRunning = task.status === "IN_PROGRESS";
  const elapsed = useElapsedTime(task.updatedAt, isRunning);

  const statusColor = (() => {
    switch (task.status) {
      case "COMPLETED":
        return "success" as const;
      case "IN_PROGRESS":
        return "default" as const;
      case "FAILED":
        return "destructive" as const;
      default:
        return "outline" as const;
    }
  })();

  const parsedResult = task.result
    ? (() => {
        try {
          const r = JSON.parse(task.result) as Record<string, unknown>;
          if (typeof r.error === "string") return `Error: ${r.error}`;
          if (typeof r.text === "string" && r.text.length > 0) return r.text;
          // Fall back to pretty-printing the full object
          return JSON.stringify(r, null, 2);
        } catch {
          return task.result;
        }
      })()
    : null;

  return (
    <div
      className={`border border-dashed p-4 space-y-2 cursor-pointer transition-colors ${
        isSelected
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/50"
      }`}
      onClick={onSelect}
    >
      <h4 className="font-bold text-sm leading-tight text-foreground">
        {task.title}
      </h4>
      {task.description && (
        <p className="text-[11px] text-muted-foreground line-clamp-3 leading-relaxed">
          {task.description}
        </p>
      )}
      <div className="flex items-center gap-2 pt-1 flex-wrap">
        <Badge variant="secondary">{task.category}</Badge>
        <Badge variant={statusColor}>
          {isRunning && elapsed ? `Running ${elapsed}` : task.status}
        </Badge>
        {task.agentName && (
          <Badge variant="outline" className="text-[10px]">
            {task.agentName}
          </Badge>
        )}
        {task.scheduledFor && (
          <Badge variant="outline" className="text-[10px]">
            {formatDate(task.scheduledFor)}
          </Badge>
        )}
      </div>

      {/* Expanded detail section */}
      {isSelected && (
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
      )}
    </div>
  );
}
