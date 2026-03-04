"use client";

import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { api, Task } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";

interface EngineerPanelProps {
  projectId: string;
}

function parseCodeResult(result: string | null): {
  text: string;
  stdout?: string;
  stderr?: string;
  language?: string;
  success?: boolean;
} {
  if (!result) return { text: "" };
  try {
    const parsed = JSON.parse(result) as Record<string, unknown>;
    const text = (parsed.text as string) || "";
    // Look for code execution results nested in toolResults
    const toolResults = parsed.toolResults as Array<{
      tool: string;
      result: Record<string, unknown>;
    }> | undefined;
    const execResult = toolResults?.find((r) => r.tool === "executeCode")?.result;
    return {
      text,
      stdout: execResult ? (execResult.stdout as string) : undefined,
      stderr: execResult ? (execResult.stderr as string) : undefined,
      language: execResult ? (execResult.language as string) : undefined,
      success: execResult ? (execResult.success as boolean) : undefined,
    };
  } catch {
    return { text: result };
  }
}

function EngineerTaskCard({ task }: { task: Task }) {
  const [expanded, setExpanded] = useState(false);
  const parsed = parseCodeResult(task.result);

  const statusColor =
    task.status === "COMPLETED"
      ? "bg-primary/10 text-primary border-primary/20"
      : task.status === "IN_PROGRESS"
        ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
        : task.status === "FAILED"
          ? "bg-destructive/10 text-destructive border-destructive/20"
          : "bg-muted text-muted-foreground border-border";

  return (
    <div className="border border-dashed border-border p-3 space-y-2">
      <div
        className="flex items-start gap-2 cursor-pointer"
        onClick={() => setExpanded((p) => !p)}
      >
        <span className="text-muted-foreground text-xs mt-0.5 select-none">
          {expanded ? "▼" : "▶"}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold truncate">{task.title}</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 border rounded font-mono uppercase tracking-wider ${statusColor}`}
            >
              {task.status}
            </span>
            {parsed.language && (
              <Badge variant="outline" className="text-[9px] font-mono px-1 py-0">
                {parsed.language}
              </Badge>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
            {task.description.substring(0, 120)}
            {task.description.length > 120 ? "..." : ""}
          </p>
        </div>
      </div>

      {expanded && (
        <div className="mt-2 space-y-2 pl-4 border-l border-border">
          {/* Full description */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
              Task
            </p>
            <p className="text-xs leading-relaxed">{task.description}</p>
          </div>

          {/* Agent summary */}
          {parsed.text && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                Agent Output
              </p>
              <p className="text-xs leading-relaxed whitespace-pre-wrap">
                {parsed.text.substring(0, 500)}
                {parsed.text.length > 500 ? "..." : ""}
              </p>
            </div>
          )}

          {/* Code stdout */}
          {parsed.stdout && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                Execution Output
              </p>
              <pre className="text-[10px] font-mono bg-muted/50 border border-border p-2 rounded overflow-x-auto whitespace-pre-wrap max-h-32 overflow-y-auto">
                {parsed.stdout.substring(0, 1000)}
                {parsed.stdout.length > 1000 ? "\n..." : ""}
              </pre>
            </div>
          )}

          {/* Code stderr */}
          {parsed.stderr && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-destructive/70 font-semibold mb-1">
                Stderr
              </p>
              <pre className="text-[10px] font-mono bg-destructive/5 border border-destructive/20 p-2 rounded overflow-x-auto whitespace-pre-wrap max-h-24 overflow-y-auto text-destructive/80">
                {parsed.stderr.substring(0, 500)}
              </pre>
            </div>
          )}

          {task.completedAt && (
            <p className="text-[10px] text-muted-foreground">
              Completed {formatDate(task.completedAt)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function EngineerPanel({ projectId }: EngineerPanelProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    try {
      const data = await api.tasks.list({ projectId, category: "ENGINEERING" });
      setTasks(data);
    } catch (err) {
      console.error("Failed to fetch engineering tasks:", err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    setLoading(true);
  }, [projectId]);

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 8000);
    return () => clearInterval(interval);
  }, [fetchTasks]);

  const completedCount = tasks.filter((t) => t.status === "COMPLETED").length;
  const runningCount = tasks.filter((t) => t.status === "IN_PROGRESS").length;

  if (loading) {
    return (
      <div className="space-y-3">
        <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Engineering
        </h3>
        <div className="flex items-center justify-center py-8">
          <span className="text-xs text-muted-foreground animate-pulse">
            Loading...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Engineering
        </h3>
        <div className="flex items-center gap-2">
          {runningCount > 0 && (
            <span className="text-[10px] text-yellow-600 animate-pulse font-mono">
              {runningCount} running
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">
            {completedCount}/{tasks.length} done
          </span>
        </div>
      </div>

      <div className="space-y-2 overflow-y-auto max-h-[700px] pr-1 scrollbar-thin">
        {tasks.length === 0 ? (
          <div className="border border-dashed border-border p-6 text-center">
            <p className="text-xs text-muted-foreground">
              No engineering tasks yet. The planner will assign coding tasks to
              the engineering agent automatically.
            </p>
            <p className="text-[10px] text-muted-foreground mt-2">
              Requires E2B_API_KEY for sandboxed code execution.
            </p>
          </div>
        ) : (
          tasks.map((task) => (
            <EngineerTaskCard key={task.id} task={task} />
          ))
        )}
      </div>
    </div>
  );
}
