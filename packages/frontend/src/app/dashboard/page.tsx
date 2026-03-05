"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { api, type Project } from "@/lib/api-client";
import { CompanyPanel } from "@/components/dashboard/company-panel";
import { TasksPanel } from "@/components/dashboard/tasks-panel";
import { TwitterPanel } from "@/components/dashboard/twitter-panel";
import { EngineerPanel } from "@/components/dashboard/engineer-panel";
import { ReportPanel } from "@/components/dashboard/report-panel";
import { AskPanel } from "@/components/dashboard/ask-panel";
import { CollapsibleColumn } from "@/components/ui/collapsible-column";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  const { user } = useUser();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [credits, setCredits] = useState<number>(100);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!user?.id) return;

    Promise.all([
      api.projects.list(),
      api.users.credits().catch(() => ({ credits: 100 })),
    ])
      .then(([p, creditsData]) => {
        setProjects(p);
        if (p.length > 0) {
          setSelectedProject(p[0]!);
        }
        setCredits(creditsData.credits);
      })
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false));
  }, [user?.id]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-xs text-muted-foreground uppercase tracking-wider animate-pulse">
          Loading dashboard...
        </span>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <div className="border border-destructive/50 bg-destructive/5 p-6 text-center max-w-sm">
          <p className="text-xs text-destructive font-semibold uppercase tracking-wider mb-2">
            Failed to load dashboard
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            Could not connect to the backend. Check that the server is running.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6">
        <div className="border-[1.5px] border-dashed border-border p-10 text-center max-w-md relative bp-corners">
          <h2 className="text-2xl font-bold text-primary mb-2">
            Welcome to OneraOS
          </h2>
          <p className="text-xs text-muted-foreground mb-6">
            Create your first company to get started. The AI will automatically
            research your product and begin planning tasks.
          </p>
          <Button onClick={() => router.push("/new")}>+ Create Company</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Project selector — shown when user has multiple projects */}
      {projects.length > 1 && (
        <div className="border-b border-dashed border-border px-4 py-2 flex items-center gap-3 shrink-0">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Project:
          </span>
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin">
            {projects.map((p) => (
                <Button
                  key={p.id}
                  onClick={() => setSelectedProject(p)}
                  size="sm"
                  variant={selectedProject?.id === p.id ? "default" : "outline"}
                  className={`shrink-0 ${
                    selectedProject?.id === p.id
                      ? ""
                      : "border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary"
                }`}
                >
                  {p.name}
                </Button>
              ))}
            </div>
          </div>
      )}

      {/* 5-column dashboard — collapsible */}
      <div className="flex-1 flex overflow-hidden">
        <CollapsibleColumn title="Company" className="p-4">
          <CompanyPanel
            projectName={selectedProject?.name || ""}
            projectId={selectedProject?.id}
            credits={credits}
            projectWebsite={selectedProject?.website}
            projectDescription={selectedProject?.description}
          />
        </CollapsibleColumn>

        <CollapsibleColumn title="Tasks" className="p-4">
          {selectedProject && (
            <TasksPanel key={selectedProject.id} projectId={selectedProject.id} />
          )}
        </CollapsibleColumn>

        <CollapsibleColumn title="Social" className="p-4">
          {selectedProject && (
            <TwitterPanel key={selectedProject.id} projectId={selectedProject.id} />
          )}
        </CollapsibleColumn>

        <CollapsibleColumn title="Engineering" className="p-4">
          {selectedProject && (
            <EngineerPanel key={selectedProject.id} projectId={selectedProject.id} />
          )}
        </CollapsibleColumn>

        <CollapsibleColumn title="Reports" isLast className="p-4">
          {selectedProject && (
            <ReportPanel key={selectedProject.id} projectId={selectedProject.id} />
          )}
        </CollapsibleColumn>
      </div>

      {/* Floating Ask OneraOS chat widget */}
      <AskPanel projectId={selectedProject?.id} />
    </div>
  );
}
