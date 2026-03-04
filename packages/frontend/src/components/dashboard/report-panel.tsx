"use client";

import { useEffect, useState, useCallback } from "react";
import { api, DailyReport } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";

interface ReportPanelProps {
  projectId: string;
}

export function ReportPanel({ projectId }: ReportPanelProps) {
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReports = useCallback(async () => {
    try {
      const data = await api.reports.list(projectId);
      setReports(data);
    } catch (err) {
      console.error("Failed to fetch reports:", err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchReports();
    // Poll every 15 seconds (reports change less often)
    const interval = setInterval(fetchReports, 15000);
    return () => clearInterval(interval);
  }, [fetchReports]);

  if (loading) {
    return (
      <div className="space-y-3">
        <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Daily Report
        </h3>
        <div className="flex items-center justify-center py-8">
          <span className="text-xs text-muted-foreground animate-pulse">
            Loading...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        Daily Report
      </h3>
      <div className="overflow-y-auto max-h-[700px] pr-1 space-y-0 scrollbar-thin">
        {reports.length === 0 && (
          <div className="border border-dashed border-border p-6 text-center">
            <p className="text-xs text-muted-foreground">
              No reports yet. Reports are generated automatically each day at 6
              PM.
            </p>
          </div>
        )}
        {reports.map((report, index) => (
          <ReportEntry key={report.id || index} report={report} />
        ))}
      </div>
    </div>
  );
}

function parseJsonField(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => {
        if (typeof item === "string") return item;
        if (typeof item === "object" && item !== null) {
          // Handle {title, category} objects from report worker
          const obj = item as Record<string, unknown>;
          return (obj.title as string) || (obj.name as string) || JSON.stringify(item);
        }
        return String(item);
      });
    }
    if (typeof parsed === "object" && parsed !== null) {
      return Object.values(parsed as Record<string, unknown>).map((v) => {
        if (typeof v === "string") return v;
        if (typeof v === "object" && v !== null) {
          const obj = v as Record<string, unknown>;
          return (obj.title as string) || JSON.stringify(v);
        }
        return String(v);
      });
    }
    return [String(parsed)];
  } catch {
    return value
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  }
}

function ReportEntry({ report }: { report: DailyReport }) {
  const completedItems = parseJsonField(report.tasksCompleted);
  const plannedItems = parseJsonField(report.tasksPlanned);

  return (
    <div className="relative">
      {/* Day divider */}
      <div className="flex items-center gap-3 py-3">
        <div className="flex-1 border-t border-dashed border-border" />
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Day {report.day}
        </span>
        <div className="flex-1 border-t border-dashed border-border" />
      </div>

      {/* Report content */}
      <div className="border-l-2 border-primary pl-4 pb-4 ml-2">
        {/* Shipped section */}
        {completedItems.length > 0 && (
          <div className="mb-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
              Shipped today:
            </p>
            <div className="space-y-1.5">
              {completedItems.map((item, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className="text-primary font-bold shrink-0">
                    &check;
                  </span>
                  <span className="leading-relaxed">
                    <span className="font-semibold">{item}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* General content */}
        {report.content && (
          <div className="text-xs leading-relaxed whitespace-pre-wrap mb-3">
            {report.content}
          </div>
        )}

        {/* Tomorrow section */}
        {plannedItems.length > 0 && (
          <div>
            <p className="text-xs font-bold mb-1">Tomorrow:</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {plannedItems.join(", then ")}
            </p>
          </div>
        )}

        {report.date && (
          <p className="text-[10px] text-muted-foreground mt-2">
            {formatDate(report.date)}
          </p>
        )}
      </div>
    </div>
  );
}
