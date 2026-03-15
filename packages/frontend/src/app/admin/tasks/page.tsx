"use client";

import { useState, useEffect, useCallback } from "react";
import { api, type Task } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatRelativeTime } from "@/lib/utils";

type StatusFilter = "ALL" | "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "CANCELLED";
type CategoryFilter = "ALL" | "OUTREACH" | "TWITTER" | "RESEARCH" | "ENGINEERING" | "GROWTH" | "MARKETING";

const PAGE_SIZE = 30;

function statusBadgeVariant(status: string): "default" | "outline" | "secondary" | "destructive" {
  switch (status) {
    case "COMPLETED": return "default";
    case "IN_PROGRESS": return "outline";
    case "FAILED": return "destructive";
    case "CANCELLED": return "secondary";
    default: return "outline";
  }
}

export default function AdminTasksPage() {
  const [tasks, setTasks] = useState<(Task & { project: { name: string } })[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("ALL");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.admin.tasks.list({
        page,
        limit: PAGE_SIZE,
        status: statusFilter !== "ALL" ? statusFilter : undefined,
        category: categoryFilter !== "ALL" ? categoryFilter : undefined,
      });
      setTasks(data.tasks);
      setTotal(data.total);
    } catch (err) {
      console.error("Failed to fetch tasks:", err);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, categoryFilter]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);
  useEffect(() => { setPage(1); }, [statusFilter, categoryFilter]);

  const handleRetry = async (taskId: string) => {
    setActionLoading(taskId);
    try {
      await api.admin.tasks.update(taskId, { status: "PENDING" });
      await fetchTasks();
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (taskId: string) => {
    setActionLoading(taskId);
    try {
      await api.admin.tasks.update(taskId, { status: "CANCELLED" });
      await fetchTasks();
    } finally {
      setActionLoading(null);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="font-serif text-2xl font-bold">Tasks</h1>
        <Separator className="flex-1" />
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{total} total</span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Status:</span>
          {(["ALL", "PENDING", "IN_PROGRESS", "COMPLETED", "FAILED", "CANCELLED"] as StatusFilter[]).map((s) => (
            <Button key={s} size="sm" variant={statusFilter === s ? "default" : "outline"} onClick={() => setStatusFilter(s)}
              className={statusFilter === s ? "" : "border-dashed text-muted-foreground text-[10px]"}>
              {s === "ALL" ? "All" : s === "IN_PROGRESS" ? "Running" : s.charAt(0) + s.slice(1).toLowerCase()}
            </Button>
          ))}
        </div>
        <Separator orientation="vertical" className="h-6" />
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Category:</span>
          {(["ALL", "OUTREACH", "TWITTER", "RESEARCH", "ENGINEERING"] as CategoryFilter[]).map((c) => (
            <Button key={c} size="sm" variant={categoryFilter === c ? "default" : "outline"} onClick={() => setCategoryFilter(c)}
              className={categoryFilter === c ? "" : "border-dashed text-muted-foreground text-[10px]"}>
              {c === "ALL" ? "All" : c}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <span className="text-xs text-muted-foreground animate-pulse">Loading...</span>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="border-b-2">
              <TableHead>Task</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Agent</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Credits</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((task) => (
              <TableRow key={task.id} className="hover:bg-primary/5">
                <TableCell>
                  <span className="text-xs font-medium block truncate max-w-[250px]">{task.title}</span>
                  {task.summary && (
                    <p className="text-[10px] text-muted-foreground truncate max-w-[250px]">{task.summary}</p>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[9px] font-mono">{task.category}</Badge>
                </TableCell>
                <TableCell>
                  <span className="text-[10px] font-mono">{task.agentName || "—"}</span>
                </TableCell>
                <TableCell>
                  <span className="text-xs">{task.project?.name || "—"}</span>
                </TableCell>
                <TableCell>
                  <Badge variant={statusBadgeVariant(task.status)} className="text-[9px]">
                    {task.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="font-mono text-[10px] text-primary">{(task as Task & { credits?: number }).credits || 1}</span>
                </TableCell>
                <TableCell>
                  <span className="text-[10px] text-muted-foreground">{formatRelativeTime(task.createdAt)}</span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {task.status === "FAILED" && (
                      <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]"
                        onClick={() => handleRetry(task.id)} disabled={actionLoading === task.id}>
                        Retry
                      </Button>
                    )}
                    {(task.status === "PENDING" || task.status === "IN_PROGRESS") && (
                      <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] text-destructive"
                        onClick={() => handleCancel(task.id)} disabled={actionLoading === task.id}>
                        Cancel
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-dashed border-border">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            &larr; Prev
          </Button>
          <span className="text-[10px] font-mono text-muted-foreground">Page {page} of {totalPages}</span>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next &rarr;
          </Button>
        </div>
      )}
    </div>
  );
}
