"use client";

import { useState, useEffect, useCallback } from "react";
import { api, type AdminUser } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatRelativeTime } from "@/lib/utils";

const PAGE_SIZE = 25;

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.admin.users.list({ page, limit: PAGE_SIZE, search: search || undefined });
      setUsers(data.users);
      setTotal(data.total);
    } catch (err) {
      console.error("Failed to fetch users:", err);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => { setPage(1); }, [search]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="font-serif text-2xl font-bold">Users</h1>
        <Separator className="flex-1" />
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{total} total</span>
      </div>

      <div className="flex items-center gap-3">
        <Input
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm border-2 text-xs"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <span className="text-xs text-muted-foreground animate-pulse">Loading...</span>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="border-b-2">
              <TableHead>User</TableHead>
              <TableHead>Credits</TableHead>
              <TableHead>Subscription</TableHead>
              <TableHead>Projects</TableHead>
              <TableHead>Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id} className="hover:bg-primary/5">
                <TableCell>
                  <div>
                    <span className="text-xs font-medium">{user.name || "No name"}</span>
                    <p className="text-[10px] text-muted-foreground font-mono">{user.email || "No email"}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="font-mono font-bold text-primary">{user.credits}</span>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={user.subscriptionStatus === "active" ? "default" : "outline"}
                    className="text-[9px]"
                  >
                    {user.subscriptionStatus || "none"}
                  </Badge>
                  {user.trialActivated && (
                    <Badge variant="secondary" className="text-[9px] ml-1">trial</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <span className="font-mono">{user._count.projects}</span>
                </TableCell>
                <TableCell>
                  <span className="text-[10px] text-muted-foreground">{formatRelativeTime(user.createdAt)}</span>
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
