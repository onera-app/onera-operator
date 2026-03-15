"use client";

import { useState, useEffect } from "react";
import { api, type AdminAgent } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatRelativeTime } from "@/lib/utils";

export default function AdminAgentsPage() {
  const [agents, setAgents] = useState<AdminAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggerLoading, setTriggerLoading] = useState<string | null>(null);

  useEffect(() => {
    api.admin.agents().then(setAgents).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleTrigger = async (name: string) => {
    setTriggerLoading(name);
    try {
      // Trigger via existing agent trigger endpoint (requires a projectId)
      // For now, just refresh the status
      const updated = await api.admin.agents();
      setAgents(updated);
    } finally {
      setTriggerLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="text-xs text-muted-foreground animate-pulse">Loading agents...</span>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="font-serif text-2xl font-bold">Agents</h1>
        <Separator className="flex-1" />
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{agents.length} agents</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents.map((agent) => (
          <Card key={agent.id} className="border-2 border-zinc-100 rounded-none shadow-none hover:border-primary transition-colors">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="font-serif text-base">{agent.displayName}</CardTitle>
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${
                    agent.status === "idle" ? "bg-green-500" :
                    agent.status === "running" ? "bg-blue-500 animate-pulse" :
                    "bg-red-500"
                  }`} />
                  <Badge variant="outline" className="text-[9px] font-mono">{agent.status}</Badge>
                </div>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{agent.name}</span>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <span className="text-sm font-mono font-bold">{agent.tasksCompleted}</span>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Completed</p>
                </div>
                <div>
                  <span className="text-sm font-mono font-bold">{agent.totalExecutions}</span>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Executions</p>
                </div>
                <div>
                  <span className={`text-sm font-mono font-bold ${agent.errorRate > 20 ? "text-red-600" : ""}`}>{agent.errorRate}%</span>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Error Rate</p>
                </div>
              </div>

              {agent.lastRunAt && (
                <p className="text-[10px] text-muted-foreground">
                  Last run: {formatRelativeTime(agent.lastRunAt)}
                </p>
              )}

              {agent.lastError && (
                <div className="bg-red-50 border border-red-200 p-2">
                  <p className="text-[10px] text-red-700 font-mono truncate">{agent.lastError}</p>
                </div>
              )}

              {/* Recent execution logs */}
              {agent.recentLogs.length > 0 && (
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Recent Activity</p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {agent.recentLogs.slice(0, 5).map((log) => (
                      <div key={log.id} className="flex items-center justify-between py-0.5">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-1.5 h-1.5 rounded-full ${log.status === "success" ? "bg-green-500" : "bg-red-500"}`} />
                          <span className="text-[10px] truncate max-w-[140px]">{log.action}</span>
                        </div>
                        <span className="text-[9px] text-muted-foreground font-mono">
                          {log.duration ? `${log.duration}ms` : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button
                size="sm"
                variant="outline"
                className="w-full text-[10px] border-dashed"
                onClick={() => handleTrigger(agent.name)}
                disabled={triggerLoading === agent.name}
              >
                Refresh Status
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
