"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  api,
  type EmailConversation,
  type ConversationStats,
  type ConversationDetail,
  type EmailLogEntry,
} from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { formatRelativeTime } from "@/lib/utils";

type StatusFilter = "ALL" | "ACTIVE" | "REPLIED" | "FOLLOW_UP" | "CLOSED";

function statusBadgeVariant(status: string) {
  switch (status) {
    case "REPLIED": return "default";
    case "ACTIVE": return "outline";
    case "FOLLOW_UP": return "secondary";
    case "CLOSED": return "secondary";
    default: return "outline";
  }
}

function deliveryBadge(status: string) {
  switch (status) {
    case "DELIVERED": return { label: "Delivered", className: "bg-green-100 text-green-800 border-transparent" };
    case "OPENED": return { label: "Opened", className: "bg-blue-100 text-blue-800 border-transparent" };
    case "CLICKED": return { label: "Clicked", className: "bg-purple-100 text-purple-800 border-transparent" };
    case "BOUNCED": return { label: "Bounced", className: "bg-red-100 text-red-800 border-transparent" };
    case "FAILED": return { label: "Failed", className: "bg-red-100 text-red-800 border-transparent" };
    case "PENDING": return { label: "Pending", className: "bg-yellow-100 text-yellow-800 border-transparent" };
    default: return { label: status, className: "" };
  }
}

export default function EmailDashboardPage() {
  const { isLoaded, isSignedIn } = useUser();
  const router = useRouter();

  // Project selection — pick from user's projects
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [conversations, setConversations] = useState<(EmailConversation & { emailLogs: EmailLogEntry[] })[]>([]);
  const [stats, setStats] = useState<ConversationStats | null>(null);
  const [selectedConv, setSelectedConv] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (isLoaded && !isSignedIn) router.push("/login");
  }, [isLoaded, isSignedIn, router]);

  // Load projects
  useEffect(() => {
    api.projects.list().then((ps) => {
      setProjects(ps.map((p) => ({ id: p.id, name: p.name })));
      if (ps.length > 0 && !projectId) setProjectId(ps[0].id);
    }).catch(console.error);
  }, []);

  const fetchData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const [convData, statsData] = await Promise.all([
        api.conversations.list(projectId, {
          status: filter !== "ALL" ? filter : undefined,
          page,
          limit: 20,
        }),
        api.conversations.stats(projectId),
      ]);
      setConversations(convData.conversations);
      setTotal(convData.total);
      setStats(statsData);
    } catch (err) {
      console.error("Failed to fetch conversations:", err);
    } finally {
      setLoading(false);
    }
  }, [projectId, filter, page]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(1); }, [filter, projectId]);

  const loadThread = async (convId: string) => {
    if (!projectId) return;
    setThreadLoading(true);
    try {
      const conv = await api.conversations.get(projectId, convId);
      setSelectedConv(conv);
    } catch (err) {
      console.error("Failed to load thread:", err);
    } finally {
      setThreadLoading(false);
    }
  };

  if (!isLoaded || !isSignedIn) return null;

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-dashed border-border bg-background/80">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="text-xs">
                &larr; Dashboard
              </Button>
            </Link>
            <h1 className="font-serif text-xl font-bold">Email Conversations</h1>
          </div>
          {/* Project switcher */}
          {projects.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground">Project:</span>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="bg-background border border-border px-2 py-1 text-xs font-mono focus:border-primary outline-none"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Stats bar */}
        {stats && (
          <div className="flex items-center gap-6">
            <StatCard label="Total" value={stats.conversations.total} />
            <StatCard label="Active" value={stats.conversations.active} />
            <StatCard label="Replied" value={stats.conversations.replied} accent />
            <StatCard label="Follow-ups" value={stats.conversations.followUp} />
            <Separator orientation="vertical" className="h-8" />
            <StatCard label="Sent" value={stats.emails.totalSent} />
            <StatCard label="Received" value={stats.emails.totalReceived} accent />
            <StatCard label="Reply Rate" value={`${stats.rates.replyRate}%`} />
            <StatCard label="Delivery" value={`${stats.rates.deliveryRate}%`} />
            <StatCard label="Bounced" value={`${stats.rates.bounceRate}%`} warn={stats.rates.bounceRate > 10} />
          </div>
        )}
      </div>

      {/* Filter tabs */}
      <div className="px-6 py-2 border-b border-dashed border-border flex items-center gap-2">
        {(["ALL", "ACTIVE", "REPLIED", "FOLLOW_UP", "CLOSED"] as StatusFilter[]).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={filter === s ? "default" : "outline"}
            onClick={() => setFilter(s)}
            className={filter === s ? "" : "border-dashed text-muted-foreground hover:border-primary hover:text-primary"}
          >
            {s === "ALL" ? "All" : s === "FOLLOW_UP" ? "Follow-up" : s.charAt(0) + s.slice(1).toLowerCase()}
          </Button>
        ))}
        <span className="ml-auto text-[10px] font-mono text-muted-foreground">
          {total} conversation{total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Main content — split view */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Conversation list — left panel */}
        <div className="w-[420px] border-r border-dashed border-border overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <span className="text-xs text-muted-foreground animate-pulse">Loading...</span>
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-xs text-muted-foreground">No conversations found.</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                Conversations are created automatically when outreach emails are sent.
              </p>
            </div>
          ) : (
            <>
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => loadThread(conv.id)}
                  className={`px-4 py-3 border-b border-border/30 cursor-pointer transition-colors hover:bg-primary/5 ${
                    selectedConv?.id === conv.id ? "bg-primary/10 border-l-2 border-l-primary" : ""
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium truncate max-w-[240px]">
                      {conv.contact?.name || conv.contact?.email || "Unknown"}
                    </span>
                    <Badge
                      variant={statusBadgeVariant(conv.status)}
                      className="text-[9px] px-1.5 py-0"
                    >
                      {conv.status === "FOLLOW_UP" ? "Follow-up" : conv.status.charAt(0) + conv.status.slice(1).toLowerCase()}
                    </Badge>
                  </div>
                  {conv.contact?.company && (
                    <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mb-0.5">
                      {conv.contact.company}
                      {conv.contact.role && ` · ${conv.contact.role}`}
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground truncate">{conv.subject}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-muted-foreground">
                      {conv.messageCount} message{conv.messageCount !== 1 ? "s" : ""}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatRelativeTime(conv.lastActivityAt)}
                    </span>
                  </div>
                </div>
              ))}
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                  <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="text-xs">
                    &larr; Prev
                  </Button>
                  <span className="text-[10px] font-mono text-muted-foreground">{page}/{totalPages}</span>
                  <Button size="sm" variant="ghost" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="text-xs">
                    Next &rarr;
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Thread view — right panel */}
        <div className="flex-1 overflow-y-auto bg-background/50">
          {threadLoading ? (
            <div className="flex items-center justify-center h-full">
              <span className="text-xs text-muted-foreground animate-pulse">Loading thread...</span>
            </div>
          ) : selectedConv ? (
            <div className="p-6 max-w-3xl mx-auto">
              {/* Thread header */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={statusBadgeVariant(selectedConv.status)} className="text-[9px]">
                    {selectedConv.status}
                  </Badge>
                  <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                    {selectedConv.messageCount} messages
                  </span>
                </div>
                <h2 className="font-serif text-lg font-bold">{selectedConv.subject}</h2>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs">{selectedConv.contact?.name || selectedConv.contact?.email}</span>
                  {selectedConv.contact?.company && (
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {selectedConv.contact.company}
                    </span>
                  )}
                  {selectedConv.contact?.companyUrl && (
                    <a
                      href={selectedConv.contact.companyUrl.startsWith("http") ? selectedConv.contact.companyUrl : `https://${selectedConv.contact.companyUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-primary underline"
                    >
                      {selectedConv.contact.companyUrl}
                    </a>
                  )}
                </div>
              </div>

              <Separator className="mb-6" />

              {/* Messages */}
              <div className="space-y-4">
                {selectedConv.emailLogs?.map((msg) => (
                  <div
                    key={msg.id}
                    className={`border rounded-none p-4 ${
                      msg.direction === "INBOUND"
                        ? "border-primary/30 bg-primary/5 ml-0 mr-12"
                        : "border-border bg-white ml-12 mr-0"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                          {msg.direction === "INBOUND" ? "Received" : "Sent"}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {msg.direction === "OUTBOUND" ? msg.fromEmail : msg.fromEmail}
                        </span>
                        {msg.direction === "OUTBOUND" && (
                          <span className="text-[10px] text-muted-foreground">
                            &rarr; {msg.toEmail}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {msg.direction === "OUTBOUND" && msg.deliveryStatus && (
                          <Badge className={`text-[9px] px-1.5 py-0 ${deliveryBadge(msg.deliveryStatus).className}`}>
                            {deliveryBadge(msg.deliveryStatus).label}
                          </Badge>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          {formatRelativeTime(msg.sentAt)}
                        </span>
                      </div>
                    </div>
                    <p className="text-[11px] font-medium mb-2">{msg.subject}</p>
                    <div className="text-xs leading-relaxed whitespace-pre-wrap text-foreground/80">
                      {msg.body}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Select a conversation to view the thread</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Conversations show the full email exchange between agents and contacts
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent, warn }: { label: string; value: number | string; accent?: boolean; warn?: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <span className={`text-sm font-mono font-bold ${warn ? "text-red-600" : accent ? "text-primary" : ""}`}>
        {value}
      </span>
      <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono">{label}</span>
    </div>
  );
}
