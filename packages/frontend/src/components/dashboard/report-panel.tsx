"use client";

import { useEffect, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { api, DailyReport } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";
import { CollapsibleSection } from "@/components/ui/collapsible-section";

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

  // Reset loading state when project changes (before new data arrives)
  useEffect(() => {
    setLoading(true);
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
    <CollapsibleSection
      title="Daily Report"
      badge={
        reports.length > 0 ? (
          <span className="text-[10px] text-muted-foreground">{reports.length} reports</span>
        ) : undefined
      }
    >
      <div className="overflow-y-auto pr-1 space-y-0 scrollbar-thin">
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
    </CollapsibleSection>
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

function parseMetrics(value: string | null): {
  highlights: string[];
  blockers: string[];
  nextSteps: string[];
} {
  const empty = { highlights: [], blockers: [], nextSteps: [] };
  if (!value) return empty;
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return {
      highlights: Array.isArray(parsed.highlights)
        ? (parsed.highlights as string[])
        : [],
      blockers: Array.isArray(parsed.blockers)
        ? (parsed.blockers as string[])
        : [],
      nextSteps: Array.isArray(parsed.nextSteps)
        ? (parsed.nextSteps as string[])
        : [],
    };
  } catch {
    return empty;
  }
}

function ReportEntry({ report }: { report: DailyReport }) {
  const completedItems = parseJsonField(report.tasksCompleted);
  const plannedItems = parseJsonField(report.tasksPlanned);
  const { highlights, blockers, nextSteps } = parseMetrics(report.metrics);

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
                  <span className="leading-relaxed font-semibold">{item}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Highlights */}
        {highlights.length > 0 && (
          <div className="mb-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
              Highlights:
            </p>
            <div className="space-y-1">
              {highlights.map((h, i) => (
                <p key={i} className="text-xs leading-relaxed">
                  &bull; {h}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Blockers */}
        {blockers.length > 0 && (
          <div className="mb-3">
            <p className="text-[10px] uppercase tracking-wider text-destructive/70 font-semibold mb-2">
              Blockers:
            </p>
            <div className="space-y-1">
              {blockers.map((b, i) => (
                <p key={i} className="text-xs leading-relaxed text-destructive/80">
                  &bull; {b}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* General content (rendered as markdown) */}
        {report.content && (
          <div className="mb-3 text-xs leading-relaxed [&_h1]:text-sm [&_h1]:font-bold [&_h1]:mt-3 [&_h1]:mb-1 [&_h2]:text-[10px] [&_h2]:font-bold [&_h2]:uppercase [&_h2]:tracking-wider [&_h2]:text-muted-foreground [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_p]:my-1.5 [&_p]:text-foreground/80 [&_ul]:my-1 [&_ul]:pl-4 [&_ul]:list-disc [&_ol]:my-1 [&_ol]:pl-4 [&_ol]:list-decimal [&_li]:my-0.5 [&_li]:text-foreground/80 [&_strong]:font-semibold [&_strong]:text-foreground [&_hr]:my-3 [&_hr]:border-dashed [&_hr]:border-border [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[11px] [&_code]:rounded">
            <ReactMarkdown>{report.content}</ReactMarkdown>
          </div>
        )}

        {/* Next steps */}
        {nextSteps.length > 0 && (
          <div className="mb-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
              Next steps:
            </p>
            <div className="space-y-1">
              {nextSteps.map((s, i) => (
                <p key={i} className="text-xs leading-relaxed">
                  {i + 1}. {s}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Tomorrow section (from tasksPlanned) */}
        {plannedItems.length > 0 && nextSteps.length === 0 && (
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
