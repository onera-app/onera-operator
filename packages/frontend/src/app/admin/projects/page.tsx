"use client";

import { useState, useEffect, useCallback } from "react";
import { api, type AdminProject } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatRelativeTime } from "@/lib/utils";

const PAGE_SIZE = 25;

export default function AdminProjectsPage() {
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.admin.projects.list({ page, limit: PAGE_SIZE, search: search || undefined });
      setProjects(data.projects);
      setTotal(data.total);
    } catch (err) {
      console.error("Failed to fetch projects:", err);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);
  useEffect(() => { setPage(1); }, [search]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="font-serif text-2xl font-bold">Projects</h1>
        <Separator className="flex-1" />
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{total} total</span>
      </div>

      <Input
        placeholder="Search by name or website..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm border-2 text-xs"
      />

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <span className="text-xs text-muted-foreground animate-pulse">Loading...</span>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="border-b-2">
              <TableHead>Project</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Tasks</TableHead>
              <TableHead>Emails</TableHead>
              <TableHead>Contacts</TableHead>
              <TableHead>Conversations</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((project) => (
              <TableRow key={project.id} className="hover:bg-primary/5">
                <TableCell>
                  <div>
                    <span className="text-xs font-medium">{project.name}</span>
                    {project.website && (
                      <p className="text-[10px] text-primary font-mono">{project.website}</p>
                    )}
                    {project.companyEmail && (
                      <p className="text-[10px] text-muted-foreground font-mono">{project.companyEmail}</p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-xs">{project.user?.name || project.user?.email || "Unknown"}</span>
                </TableCell>
                <TableCell>
                  <Badge variant={project.paused ? "secondary" : "default"} className="text-[9px]">
                    {project.paused ? "Paused" : "Active"}
                  </Badge>
                </TableCell>
                <TableCell><span className="font-mono">{project._count.tasks}</span></TableCell>
                <TableCell><span className="font-mono">{project._count.emailLogs}</span></TableCell>
                <TableCell><span className="font-mono">{project._count.contacts}</span></TableCell>
                <TableCell><span className="font-mono">{project._count.emailConversations}</span></TableCell>
                <TableCell>
                  <span className="text-[10px] text-muted-foreground">{formatRelativeTime(project.createdAt)}</span>
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
