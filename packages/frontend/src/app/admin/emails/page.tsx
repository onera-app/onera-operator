"use client";

import { useState, useEffect, useCallback } from "react";
import { api, type AdminEmailEntry } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatRelativeTime } from "@/lib/utils";

type DirectionFilter = "ALL" | "OUTBOUND" | "INBOUND";
type StatusFilter = "ALL" | "SENT" | "FAILED" | "BLOCKED";
type DeliveryFilter = "ALL" | "PENDING" | "DELIVERED" | "BOUNCED" | "OPENED" | "CLICKED" | "FAILED";

const PAGE_SIZE = 30;

function deliveryBadgeClass(status: string) {
  switch (status) {
    case "DELIVERED": return "bg-green-100 text-green-800 border-transparent";
    case "OPENED": return "bg-blue-100 text-blue-800 border-transparent";
    case "CLICKED": return "bg-purple-100 text-purple-800 border-transparent";
    case "BOUNCED": return "bg-red-100 text-red-800 border-transparent";
    case "FAILED": return "bg-red-100 text-red-800 border-transparent";
    default: return "bg-yellow-100 text-yellow-800 border-transparent";
  }
}

export default function AdminEmailsPage() {
  const [emails, setEmails] = useState<AdminEmailEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [direction, setDirection] = useState<DirectionFilter>("ALL");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [delivery, setDelivery] = useState<DeliveryFilter>("ALL");
  const [loading, setLoading] = useState(true);

  const fetchEmails = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.admin.emails.list({
        page,
        limit: PAGE_SIZE,
        direction: direction !== "ALL" ? direction : undefined,
        status: status !== "ALL" ? status : undefined,
        deliveryStatus: delivery !== "ALL" ? delivery : undefined,
      });
      setEmails(data.emails);
      setTotal(data.total);
    } catch (err) {
      console.error("Failed to fetch emails:", err);
    } finally {
      setLoading(false);
    }
  }, [page, direction, status, delivery]);

  useEffect(() => { fetchEmails(); }, [fetchEmails]);
  useEffect(() => { setPage(1); }, [direction, status, delivery]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="font-serif text-2xl font-bold">Emails</h1>
        <Separator className="flex-1" />
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{total} total</span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Direction:</span>
          {(["ALL", "OUTBOUND", "INBOUND"] as DirectionFilter[]).map((d) => (
            <Button key={d} size="sm" variant={direction === d ? "default" : "outline"} onClick={() => setDirection(d)}
              className={direction === d ? "" : "border-dashed text-muted-foreground text-[10px]"}>
              {d === "ALL" ? "All" : d}
            </Button>
          ))}
        </div>
        <Separator orientation="vertical" className="h-6" />
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Status:</span>
          {(["ALL", "SENT", "FAILED", "BLOCKED"] as StatusFilter[]).map((s) => (
            <Button key={s} size="sm" variant={status === s ? "default" : "outline"} onClick={() => setStatus(s)}
              className={status === s ? "" : "border-dashed text-muted-foreground text-[10px]"}>
              {s === "ALL" ? "All" : s}
            </Button>
          ))}
        </div>
        <Separator orientation="vertical" className="h-6" />
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Delivery:</span>
          {(["ALL", "DELIVERED", "BOUNCED", "OPENED", "CLICKED"] as DeliveryFilter[]).map((d) => (
            <Button key={d} size="sm" variant={delivery === d ? "default" : "outline"} onClick={() => setDelivery(d)}
              className={delivery === d ? "" : "border-dashed text-muted-foreground text-[10px]"}>
              {d === "ALL" ? "All" : d}
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
              <TableHead>Direction</TableHead>
              <TableHead>From / To</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Delivery</TableHead>
              <TableHead>Sent</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {emails.map((email) => (
              <TableRow key={email.id} className="hover:bg-primary/5">
                <TableCell>
                  <Badge variant="outline" className={`text-[9px] ${email.direction === "INBOUND" ? "border-primary text-primary" : ""}`}>
                    {email.direction === "INBOUND" ? "IN" : "OUT"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div>
                    <span className="text-[10px] font-mono text-muted-foreground">{email.fromEmail}</span>
                    <p className="text-[10px] font-mono">&rarr; {email.toEmail}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-xs truncate max-w-[200px] block">{email.subject}</span>
                  <span className="text-[9px] text-muted-foreground font-mono">{email.type}</span>
                </TableCell>
                <TableCell>
                  <span className="text-xs">{email.project?.name || "—"}</span>
                </TableCell>
                <TableCell>
                  <span className="text-xs">{email.contact?.name || email.contact?.company || "—"}</span>
                </TableCell>
                <TableCell>
                  <Badge variant={email.status === "SENT" ? "default" : email.status === "BLOCKED" ? "secondary" : "destructive"} className="text-[9px]">
                    {email.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge className={`text-[9px] ${deliveryBadgeClass(email.deliveryStatus)}`}>
                    {email.deliveryStatus}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="text-[10px] text-muted-foreground">{formatRelativeTime(email.sentAt)}</span>
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
