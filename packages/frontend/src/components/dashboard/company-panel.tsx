"use client";

import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, type TaskMetrics, type AgentStatus, type Project } from "@/lib/api-client";
import { formatRelativeTime } from "@/lib/utils";

interface CompanyPanelProps {
  projectName: string;
  projectId?: string;
  credits: number;
  projectWebsite?: string | null;
  projectDescription?: string | null;
}

export function CompanyPanel({
  projectName,
  projectId,
  credits,
  projectWebsite,
  projectDescription,
}: CompanyPanelProps) {
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [metrics, setMetrics] = useState<TaskMetrics | null>(null);
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [showIntelligence, setShowIntelligence] = useState(false);

  const fetchData = useCallback(async () => {
    if (!projectId) return;
    try {
      const [metricsData, agentsData, projectData] = await Promise.all([
        api.tasks.metrics(projectId),
        api.agents.list(),
        api.projects.get(projectId),
      ]);
      setMetrics(metricsData);
      setAgents(agentsData);
      setProject(projectData);
      setLastUpdated(new Date());
    } catch {
      // ignore
    }
  }, [projectId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  async function handleTriggerLoop() {
    if (!projectId) return;
    setTriggering(true);
    try {
      await api.loop.trigger(projectId);
    } catch {
      // ignore
    } finally {
      setTriggering(false);
      fetchData();
    }
  }

  const runningAgents = agents.filter((a) => a.status === "running");
  const isWorking = metrics && (metrics.inProgress > 0 || metrics.pending > 0);
  const status = metrics?.inProgress
    ? "Working"
    : metrics?.pending
      ? "Planning"
      : "Active";

  // Parse JSON fields for display
  const competitors = (() => {
    if (!project?.competitors) return [];
    try {
      const parsed = JSON.parse(project.competitors);
      return Array.isArray(parsed) ? parsed.slice(0, 3) : [project.competitors];
    } catch {
      return [project.competitors];
    }
  })();

  const goals = (() => {
    if (!project?.goals) return [];
    try {
      const parsed = JSON.parse(project.goals);
      return Array.isArray(parsed) ? parsed.slice(0, 3) : [project.goals];
    } catch {
      return [project.goals];
    }
  })();

  return (
    <div className="space-y-5">
      {/* Company name and details */}
      <div>
        <h2 className="text-lg font-bold text-primary tracking-tight">
          {projectName}
        </h2>
        {projectDescription && (
          <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed line-clamp-3">
            {projectDescription}
          </p>
        )}
        {projectWebsite && (
          <a
            href={projectWebsite}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-primary hover:underline mt-1 block truncate"
          >
            {projectWebsite.replace(/^https?:\/\//, "")}
          </a>
        )}
      </div>

      {/* Status indicator */}
      <div className="border border-dashed border-border p-4">
        <div className="flex items-center gap-3">
          {/* ASCII art bot face */}
          <div className="text-primary text-xs leading-none whitespace-pre font-bold">
            {`| ^  ^ |
| -__- |
|______|`}
          </div>
          <div>
            <Badge variant={isWorking ? "default" : "success"}>
              {status}
            </Badge>
            <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">
              {metrics?.inProgress
                ? `Running ${metrics.inProgress} task${metrics.inProgress > 1 ? "s" : ""}`
                : metrics?.pending
                  ? `${metrics.pending} task${metrics.pending > 1 ? "s" : ""} queued`
                  : "Ready to execute"}
            </p>
          </div>
        </div>
      </div>

      {/* All agents roster */}
      {agents.length > 0 && (
        <div className="border border-dashed border-border p-3 space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Agents
          </p>
          {agents.map((agent) => {
            const isRunning = agent.status === "running";
            const isError = agent.status === "error";
            return (
              <div key={agent.id} className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={`text-[10px] shrink-0 ${
                      isRunning
                        ? "text-primary animate-pulse"
                        : isError
                          ? "text-destructive"
                          : "text-muted-foreground"
                    }`}
                  >
                    {isRunning ? "●" : isError ? "✕" : "○"}
                  </span>
                  <span
                    className={`text-[10px] truncate ${
                      isRunning ? "text-foreground font-semibold" : "text-muted-foreground"
                    }`}
                  >
                    {agent.displayName}
                  </span>
                </div>
                <span className="text-[9px] text-muted-foreground/60 shrink-0">
                  {agent.tasksCompleted > 0 ? `${agent.tasksCompleted}✓` : agent.lastRunAt ? formatRelativeTime(agent.lastRunAt) : "—"}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Credits */}
      <div className="border border-dashed border-border p-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Credits
          </span>
          <span className="text-lg font-bold text-primary">{credits}</span>
        </div>
      </div>

      {/* Run agent loop button */}
      <Button
        size="sm"
        variant="outline"
        className="w-full text-[10px] uppercase tracking-wider"
        onClick={handleTriggerLoop}
        disabled={triggering || !projectId}
      >
        {triggering ? "Triggering..." : "Run Agent Loop"}
      </Button>

      {/* Separator */}
      <div className="border-t border-dashed border-border" />

      {/* Project intelligence */}
      {(project?.product || project?.targetUsers || competitors.length > 0 || goals.length > 0) && (
        <div>
          <button
            className="flex items-center justify-between w-full text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 hover:text-primary transition-colors"
            onClick={() => setShowIntelligence((v) => !v)}
          >
            <span>Intelligence</span>
            <span className="opacity-50">{showIntelligence ? "▲" : "▼"}</span>
          </button>
          {showIntelligence && (
            <div className="space-y-2">
              {project?.product && (
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60 mb-0.5">Product</p>
                  <p className="text-[10px] leading-relaxed line-clamp-3">{project.product}</p>
                </div>
              )}
              {project?.targetUsers && (
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60 mb-0.5">Target Users</p>
                  <p className="text-[10px] leading-relaxed line-clamp-2">{project.targetUsers}</p>
                </div>
              )}
              {competitors.length > 0 && (
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60 mb-0.5">Competitors</p>
                  <div className="flex flex-wrap gap-1">
                    {competitors.map((c: string, i: number) => (
                      <span key={i} className="text-[9px] border border-dashed border-border px-1.5 py-0.5 text-muted-foreground">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {goals.length > 0 && (
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60 mb-0.5">Goals</p>
                  <div className="space-y-0.5">
                    {goals.map((g: string, i: number) => (
                      <p key={i} className="text-[10px] leading-relaxed">• {g}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Task metrics */}
      {metrics && (
        <div>
          <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">
            Operations
          </h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Completed</span>
              <span className="font-bold text-primary">
                {metrics.completed}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">In Progress</span>
              <span className="font-bold text-primary">
                {metrics.inProgress}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Pending</span>
              <span className="font-bold text-primary">{metrics.pending}</span>
            </div>
            {metrics.failed > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Failed</span>
                <span className="font-bold text-destructive">
                  {metrics.failed}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Last updated */}
      <div className="text-[10px] text-muted-foreground">
        Updated {formatRelativeTime(lastUpdated.toISOString())}
        <button
          className="ml-1 text-primary hover:underline"
          onClick={fetchData}
        >
          (refresh)
        </button>
      </div>
    </div>
  );
}
