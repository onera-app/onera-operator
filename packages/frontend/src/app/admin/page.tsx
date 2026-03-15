"use client";

import { useState, useEffect } from "react";
import { api, type AdminStats } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.admin.stats().then(setStats).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="text-xs text-muted-foreground animate-pulse">Loading system stats...</span>
      </div>
    );
  }

  if (!stats) {
    return <p className="text-sm text-muted-foreground">Failed to load stats.</p>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <h1 className="font-serif text-2xl font-bold">System Overview</h1>
        <Separator className="flex-1" />
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Live Stats
        </span>
      </div>

      {/* Top-level metrics grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Total Users" value={stats.users.total} />
        <MetricCard label="Active Projects" value={stats.projects.active} sub={`${stats.projects.paused} paused`} />
        <MetricCard label="Tasks Today" value={stats.tasks.today} sub={`${stats.tasks.completed} total completed`} />
        <MetricCard label="Emails Today" value={stats.emails.today} sub={`${stats.emails.total} total sent`} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Tweets Posted" value={stats.tweets.total} sub={`${stats.tweets.today} today`} />
        <MetricCard label="Contacts" value={stats.contacts.total} />
        <MetricCard label="Conversations" value={stats.emails.conversations} sub={`${stats.emails.replyRate}% reply rate`} accent />
        <MetricCard label="Credits in Circulation" value={stats.credits.totalInCirculation} sub={`${stats.credits.consumedToday} consumed today`} />
      </div>

      {/* Task health */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-2 border-zinc-100 rounded-none shadow-none">
          <CardHeader>
            <CardTitle className="font-serif text-lg">Task Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Total Tasks</span>
                <span className="font-mono font-bold">{stats.tasks.total}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Completed</span>
                <span className="font-mono font-bold text-green-600">{stats.tasks.completed}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Failed</span>
                <span className="font-mono font-bold text-red-600">{stats.tasks.failed}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Failure Rate</span>
                <Badge className={`font-mono text-[10px] ${stats.tasks.failRate > 20 ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"} border-transparent`}>
                  {stats.tasks.failRate}%
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Agent status */}
        <Card className="border-2 border-zinc-100 rounded-none shadow-none">
          <CardHeader>
            <CardTitle className="font-serif text-lg">Agent Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.agents.map((agent) => (
                <div key={agent.name} className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      agent.status === "idle" ? "bg-green-500" :
                      agent.status === "running" ? "bg-blue-500 animate-pulse" :
                      "bg-red-500"
                    }`} />
                    <span className="text-xs font-mono">{agent.displayName}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {agent.tasksCompleted} tasks
                    </span>
                    <Badge variant="outline" className="text-[9px] px-1">
                      {agent.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Email & Reply metrics */}
      <Card className="border-2 border-zinc-100 rounded-none shadow-none">
        <CardHeader>
          <CardTitle className="font-serif text-lg">Email & Outreach</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            <div className="text-center">
              <span className="text-2xl font-mono font-bold">{stats.emails.total}</span>
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-1">Emails Sent</p>
            </div>
            <div className="text-center">
              <span className="text-2xl font-mono font-bold text-primary">{stats.emails.replied}</span>
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-1">Replies</p>
            </div>
            <div className="text-center">
              <span className="text-2xl font-mono font-bold">{stats.emails.conversations}</span>
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-1">Conversations</p>
            </div>
            <div className="text-center">
              <span className="text-2xl font-mono font-bold text-primary">{stats.emails.replyRate}%</span>
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-1">Reply Rate</p>
            </div>
            <div className="text-center">
              <span className="text-2xl font-mono font-bold">{stats.contacts.total}</span>
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-1">Contacts</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ label, value, sub, accent }: { label: string; value: number | string; sub?: string; accent?: boolean }) {
  return (
    <Card className="border-2 border-zinc-100 rounded-none shadow-none hover:border-primary transition-colors">
      <CardContent className="pt-4 pb-3 px-4">
        <span className={`text-2xl font-mono font-bold ${accent ? "text-primary" : ""}`}>{value}</span>
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-1">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}
