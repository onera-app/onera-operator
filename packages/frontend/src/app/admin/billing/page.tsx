"use client";

import { useState, useEffect, useCallback } from "react";
import { api, type AdminBillingResponse, type CreditTransaction } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatRelativeTime } from "@/lib/utils";

const PAGE_SIZE = 30;
type TypeFilter = "ALL" | "PURCHASE" | "AUTO_CHARGE" | "SUBSCRIPTION_RENEWAL" | "TASK_DEDUCTION" | "SIGNUP_BONUS" | "CARD_BONUS" | "REFUND" | "MANUAL";

export default function AdminBillingPage() {
  const [data, setData] = useState<AdminBillingResponse | null>(null);
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.admin.billing({
        page,
        limit: PAGE_SIZE,
        type: typeFilter !== "ALL" ? typeFilter : undefined,
      });
      setData(result);
    } catch (err) {
      console.error("Failed to fetch billing:", err);
    } finally {
      setLoading(false);
    }
  }, [page, typeFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(1); }, [typeFilter]);

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="font-serif text-2xl font-bold">Billing</h1>
        <Separator className="flex-1" />
      </div>

      {/* Summary cards */}
      {data?.summary && (
        <div className="grid grid-cols-3 gap-4">
          <Card className="border-2 border-zinc-100 rounded-none shadow-none">
            <CardContent className="pt-4 pb-3 px-4">
              <span className="text-2xl font-mono font-bold text-primary">{data.summary.totalCreditsInCirculation}</span>
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-1">Credits in Circulation</p>
            </CardContent>
          </Card>
          <Card className="border-2 border-zinc-100 rounded-none shadow-none">
            <CardContent className="pt-4 pb-3 px-4">
              <span className="text-2xl font-mono font-bold">{data.summary.activeSubscriptions}</span>
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-1">Active Subscriptions</p>
            </CardContent>
          </Card>
          <Card className="border-2 border-zinc-100 rounded-none shadow-none">
            <CardContent className="pt-4 pb-3 px-4">
              <span className="text-2xl font-mono font-bold">{data.summary.totalRevenue}</span>
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-1">Total Revenue (credits)</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Type filter */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Type:</span>
        {(["ALL", "PURCHASE", "AUTO_CHARGE", "SUBSCRIPTION_RENEWAL", "TASK_DEDUCTION", "SIGNUP_BONUS", "REFUND", "MANUAL"] as TypeFilter[]).map((t) => (
          <Button key={t} size="sm" variant={typeFilter === t ? "default" : "outline"} onClick={() => setTypeFilter(t)}
            className={typeFilter === t ? "" : "border-dashed text-muted-foreground text-[10px]"}>
            {t === "ALL" ? "All" : t.replace(/_/g, " ")}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <span className="text-xs text-muted-foreground animate-pulse">Loading...</span>
        </div>
      ) : data && (
        <>
          <Table>
            <TableHeader>
              <TableRow className="border-b-2">
                <TableHead>User</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.transactions.map((tx) => (
                <TableRow key={tx.id} className="hover:bg-primary/5">
                  <TableCell>
                    <span className="text-xs">{tx.user?.name || tx.user?.email || "Unknown"}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[9px] font-mono">
                      {tx.type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className={`font-mono font-bold ${tx.amount >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {tx.amount >= 0 ? "+" : ""}{tx.amount}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-[10px]">{tx.balance}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground truncate max-w-[200px] block">{tx.description}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-[10px] text-muted-foreground">{formatRelativeTime(tx.createdAt)}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

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
        </>
      )}
    </div>
  );
}
