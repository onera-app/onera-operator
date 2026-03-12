"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, type TaskMetrics, type AgentStatus, type Project, type EmailLogEntry } from "@/lib/api-client";
import { cn, formatRelativeTime } from "@/lib/utils";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { BillingSection } from "./billing-section";
import { LiveFeed } from "./live-feed";

interface CompanyPanelProps {
  projectName: string;
  projectId?: string;
  credits: number | null;
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
  const [emails, setEmails] = useState<EmailLogEntry[]>([]);
  const [triggering, setTriggering] = useState(false);
  const [triggeringAgent, setTriggeringAgent] = useState<string | null>(null);
  const [togglingPause, setTogglingPause] = useState(false);

  const fetchData = useCallback(async () => {
    if (!projectId) return;
    try {
      const [metricsData, agentsData, projectData, emailData] = await Promise.all([
        api.tasks.metrics(projectId),
        api.agents.list(),
        api.projects.get(projectId),
        api.projects.emails(projectId, { limit: 20 }),
      ]);
      setMetrics(metricsData);
      setAgents(agentsData);
      setProject(projectData);
      setEmails(emailData);
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error("[company-panel] Failed to fetch data:", err.message || err);
    }
  }, [projectId]);

  useEffect(() => {
    fetchData();
    // 10s — metrics + agents need to stay reasonably current during runs
    const interval = setInterval(fetchData, 10_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  async function handleTriggerLoop() {
    if (!projectId) return;
    setTriggering(true);
    try {
      await api.loop.trigger(projectId);
    } catch (err: any) {
      console.error("[company-panel] Loop trigger failed:", err.message || err);
    } finally {
      setTriggering(false);
      fetchData();
    }
  }

  const executableAgents = new Set(["twitter", "outreach", "research", "engineer"]);

  async function handleTriggerAgent(agentName: string) {
    if (!projectId) return;
    setTriggeringAgent(agentName);
    try {
      await api.agents.trigger(agentName, projectId);
    } catch (err: any) {
      console.error(`[company-panel] Agent trigger failed (${agentName}):`, err.message || err);
    } finally {
      setTriggeringAgent(null);
      fetchData();
    }
  }

  async function handleTogglePause() {
    if (!projectId || !project) return;
    setTogglingPause(true);
    try {
      const updated = await api.projects.pause(projectId, !project.paused);
      setProject(updated);
    } catch (err: any) {
      console.error("[company-panel] Pause toggle failed:", err.message || err);
    } finally {
      setTogglingPause(false);
    }
  }

  const isPaused = project?.paused ?? false;
  const runningAgents = agents.filter((a) => a.status === "running");
  const isWorking = metrics && (metrics.inProgress > 0 || metrics.pending > 0);
  const status = isPaused
    ? "Paused"
    : metrics?.inProgress
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
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-serif text-2xl font-extrabold text-primary tracking-tight">
            {projectName}
          </h2>
          {projectId && (
            <Link
              href={`/projects/${projectId}`}
              className="text-xs text-muted-foreground hover:text-primary transition-colors uppercase tracking-wider shrink-0 mt-1"
              title="Project Settings"
            >
              settings
            </Link>
          )}
        </div>
        {projectDescription && (
          <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed line-clamp-3">
            {projectDescription}
          </p>
        )}
        {projectWebsite && (
          <a
            href={projectWebsite}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline mt-1.5 block truncate"
          >
            {projectWebsite.replace(/^https?:\/\//, "")}
          </a>
        )}
      </div>

      {/* Status indicator */}
      <div className="border border-dashed border-border p-4">
        <div className="flex items-center gap-3">
          {/* ASCII art bot face */}
          <div className="text-primary text-sm leading-none whitespace-pre font-bold">
            {`| ^  ^ |
| -__- |
|______|`}
          </div>
          <div>
            <Badge variant={isPaused ? "destructive" : isWorking ? "default" : "success"}>
              {status}
            </Badge>
            <p className="text-xs text-muted-foreground mt-1.5 uppercase tracking-wider">
              {isPaused
                ? "Agent loops suspended"
                : metrics?.inProgress
                  ? `Running ${metrics.inProgress} task${metrics.inProgress > 1 ? "s" : ""}`
                  : metrics?.pending
                    ? `${metrics.pending} task${metrics.pending > 1 ? "s" : ""} queued`
                    : "Ready to execute"}
            </p>
          </div>
        </div>
      </div>

      {/* Business stats (last 24h) */}
      {metrics && (metrics.completedToday > 0 || metrics.tweetsPostedToday > 0 || metrics.emailsSentToday > 0) && (
        <div className="grid grid-cols-3 gap-2">
          <div className="border border-dashed border-border p-3 text-center">
            <p className="text-lg font-bold text-primary font-mono">{metrics.completedToday}</p>
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">Tasks / 24h</p>
          </div>
          <div className="border border-dashed border-border p-3 text-center">
            <p className="text-lg font-bold text-primary font-mono">{metrics.tweetsPostedToday}</p>
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">Tweets / 24h</p>
          </div>
          <div className="border border-dashed border-border p-3 text-center">
            <p className="text-lg font-bold text-primary font-mono">{metrics.emailsSentToday}</p>
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">Emails / 24h</p>
          </div>
        </div>
      )}

      {/* Live agent activity feed */}
      <LiveFeed projectId={projectId} />

      {/* All agents roster */}
      {agents.length > 0 && (
        <CollapsibleSection
          title="Agents"
          badge={
            runningAgents.length > 0 ? (
              <span className="text-xs text-primary font-mono animate-pulse">
                {runningAgents.length} active
              </span>
            ) : undefined
          }
        >
          <div className="border border-dashed border-border p-3 space-y-2.5">
            {agents.map((agent) => {
              const isRunning = agent.status === "running";
              const isError = agent.status === "error";
              const canTrigger = executableAgents.has(agent.name) && !isRunning && !isPaused;
              const isTriggeringThis = triggeringAgent === agent.name;
              return (
                <div key={agent.id} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`text-xs shrink-0 ${
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
                      className={`text-[13px] truncate ${
                        isRunning ? "text-foreground font-semibold" : "text-muted-foreground"
                      }`}
                    >
                      {agent.displayName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {canTrigger && (
                      <Button
                        onClick={() => handleTriggerAgent(agent.name)}
                        disabled={isTriggeringThis || !projectId}
                        variant="outline"
                        size="sm"
                        className="h-6 border-dashed px-2 py-0 text-[11px]"
                        title={`Run all pending ${agent.displayName} tasks`}
                      >
                        {isTriggeringThis ? "..." : "Run"}
                      </Button>
                    )}
                    <span className="text-xs text-muted-foreground/60">
                      {agent.tasksCompleted > 0 ? `${agent.tasksCompleted}` : agent.lastRunAt ? formatRelativeTime(agent.lastRunAt) : ""}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </CollapsibleSection>
      )}

      {/* Billing & Credits */}
      <BillingSection initialCredits={credits} />

      {/* Pause / Run agent loop controls */}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={isPaused ? "default" : "outline"}
          className={cn(
            "flex-1 text-xs uppercase tracking-wider",
            isPaused && "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
          )}
          onClick={handleTogglePause}
          disabled={togglingPause || !projectId}
        >
          {togglingPause ? "..." : isPaused ? "Unpause" : "Pause"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1 text-xs uppercase tracking-wider"
          onClick={handleTriggerLoop}
          disabled={triggering || !projectId || isPaused}
        >
          {triggering ? "Triggering..." : "Run Agent Loop"}
        </Button>
      </div>
      {isPaused && (
        <p className="text-xs text-destructive text-center font-mono uppercase tracking-wider">
          All agent loops and reports are suspended
        </p>
      )}

      {/* Separator */}
      <div className="border-t border-dashed border-border" />

      {/* Project intelligence */}
      {(project?.product || project?.targetUsers || competitors.length > 0 || goals.length > 0) && (
        <CollapsibleSection title="Intelligence" defaultOpen={false}>
          <div className="space-y-3">
            {project?.product && (
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground/60 mb-1">Product</p>
                <p className="text-[13px] leading-relaxed line-clamp-3">{project.product}</p>
              </div>
            )}
            {project?.targetUsers && (
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground/60 mb-1">Target Users</p>
                <p className="text-[13px] leading-relaxed line-clamp-2">{project.targetUsers}</p>
              </div>
            )}
            {competitors.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground/60 mb-1">Competitors</p>
                <div className="flex flex-wrap gap-1.5">
                  {competitors.map((c: string, i: number) => (
                    <span key={i} className="text-xs border border-dashed border-border px-2 py-0.5 text-muted-foreground">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {goals.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground/60 mb-1">Goals</p>
                <div className="space-y-1">
                  {goals.map((g: string, i: number) => (
                    <p key={i} className="text-[13px] leading-relaxed">{g}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* Task metrics */}
      {metrics && (
        <CollapsibleSection title="Operations">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Completed</span>
              <span className="font-bold text-primary">
                {metrics.completed}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">In Progress</span>
              <span className="font-bold text-primary">
                {metrics.inProgress}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Pending</span>
              <span className="font-bold text-primary">{metrics.pending}</span>
            </div>
            {metrics.failed > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Failed</span>
                <span className="font-bold text-destructive">
                  {metrics.failed}
                </span>
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* Email log */}
      {emails.length > 0 && (
        <CollapsibleSection
          title="Email Log"
          badge={
            <span className="text-xs text-muted-foreground font-mono">
              {emails.filter((e) => e.status === "SENT").length} sent
            </span>
          }
          defaultOpen={false}
        >
          <div className="border border-dashed border-border divide-y divide-dashed divide-border max-h-[300px] overflow-y-auto scrollbar-thin">
            {emails.map((email) => (
              <div key={email.id} className="px-3 py-2.5 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-foreground truncate">
                    {email.toEmail}
                  </span>
                  <span
                    className={`text-[9px] uppercase tracking-wider shrink-0 ${
                      email.status === "SENT"
                        ? "text-green-600"
                        : email.status === "BLOCKED"
                          ? "text-amber-600"
                          : "text-destructive"
                    }`}
                  >
                    {email.status}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground truncate">
                  {email.subject}
                </p>
                <p className="text-[10px] text-muted-foreground/60">
                  {formatRelativeTime(email.sentAt)}
                  {email.errorMessage && (
                    <span className="text-destructive ml-1.5">
                      {email.errorMessage.substring(0, 80)}
                    </span>
                  )}
                </p>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Last updated */}
      <div className="text-xs text-muted-foreground">
        Updated {formatRelativeTime(lastUpdated.toISOString())}
        <button
          className="ml-1.5 text-primary hover:underline"
          onClick={fetchData}
        >
          (refresh)
        </button>
      </div>
    </div>
  );
}
