"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { api, type EmailLogEntry } from "@/lib/api-client";
import { formatRelativeTime } from "@/lib/utils";
import { CollapsibleSection } from "@/components/ui/collapsible-section";

interface TwitterPanelProps {
  projectId: string;
}

interface ParsedTweet {
  text: string;
  scheduledTime: string;
}

interface ParsedEmail {
  id: string;
  subject: string;
  to: string;
  status: string;
  sentAt: string;
}

export function TwitterPanel({ projectId }: TwitterPanelProps) {
  const [tweets, setTweets] = useState<ParsedTweet[]>([]);
  const [emails, setEmails] = useState<ParsedEmail[]>([]);
  const [twitterTaskCount, setTwitterTaskCount] = useState(0);
  const [outreachTaskCount, setOutreachTaskCount] = useState(0);
  const seenEmailIds = useRef<Set<string>>(new Set());
  const [newEmailIds, setNewEmailIds] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    try {
      // Fetch from proper data sources instead of parsing raw task.result blobs
      const [tasks, tweetData, emailData] = await Promise.all([
        api.tasks.list({ projectId }),
        // Tweet queue: fetch recent tweets (reuse admin endpoint, filtered by project)
        api.admin.tweets.list({ projectId, limit: 20 }).catch(() => ({ tweets: [], total: 0, page: 1, limit: 20 })),
        // Email logs: use the proper email_logs table
        api.projects.emails(projectId, { limit: 20 }).catch(() => [] as EmailLogEntry[]),
      ]);

      setTwitterTaskCount(
        tasks.filter((t) => t.agentName === "twitter").length
      );
      setOutreachTaskCount(
        tasks.filter((t) => t.agentName === "outreach").length
      );

      // Map tweet queue entries to display format
      const parsedTweets: ParsedTweet[] = tweetData.tweets.map((t) => ({
        text: t.content,
        scheduledTime: t.postedAt || t.generatedAt,
      }));
      setTweets(parsedTweets);

      // Map email log entries to display format
      const parsedEmails: ParsedEmail[] = emailData.map((e) => ({
        id: e.id,
        subject: e.subject,
        to: e.toEmail,
        status: e.status,
        sentAt: e.sentAt,
      }));
      setEmails(parsedEmails);

      // Track newly arrived emails for highlight animation
      const incoming = new Set<string>();
      for (const e of parsedEmails) {
        if (!seenEmailIds.current.has(e.id)) {
          incoming.add(e.id);
          seenEmailIds.current.add(e.id);
        }
      }
      if (incoming.size > 0) {
        setNewEmailIds((prev) => new Set([...prev, ...incoming]));
        setTimeout(() => {
          setNewEmailIds((prev) => {
            const next = new Set(prev);
            for (const id of incoming) next.delete(id);
            return next;
          });
        }, 1800);
      }
    } catch (err) {
      console.error("Failed to fetch activity data:", err);
    }
  }, [projectId]);

  useEffect(() => {
    fetchData();
    // Reduced from 8s to 20s — tweets/emails change infrequently
    const interval = setInterval(fetchData, 20_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <div className="space-y-5">
      {/* Twitter section */}
      <CollapsibleSection
        title="Twitter"
        badge={
          tweets.length > 0 ? (
            <span className="text-[10px] text-muted-foreground">{tweets.length} tweets</span>
          ) : undefined
        }
      >
        <div className="text-[10px] text-muted-foreground mb-1">
          @onerachat
        </div>

        {tweets.length > 0 ? (
          <div className="space-y-3">
            {tweets.slice(0, 5).map((tweet, i) => (
              <div
                key={i}
                className="border border-dashed border-border p-3 space-y-2"
              >
                <p className="text-xs leading-relaxed">{tweet.text}</p>
                <span className="text-[10px] text-muted-foreground">
                  {formatRelativeTime(tweet.scheduledTime)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="border border-dashed border-border p-4 text-center">
            <p className="text-xs text-muted-foreground">
              {twitterTaskCount > 0
                ? "Generating tweets..."
                : "No tweets yet. The AI will compose tweets about your company."}
            </p>
          </div>
        )}

        <div className="text-[10px] text-muted-foreground">
          {tweets.length > 0 ? `+ ${tweets.length} tweet${tweets.length !== 1 ? "s" : ""} in the past 24h` : `${tweets.length} tweets generated`}
        </div>
      </CollapsibleSection>

      {/* Separator */}
      <div className="border-t border-dashed border-border" />

      {/* Email section */}
      <CollapsibleSection
        title="Email Outreach"
        badge={
          emails.length > 0 ? (
            <span className="text-[10px] text-muted-foreground">{emails.length} sent</span>
          ) : undefined
        }
      >
        {emails.length > 0 ? (
          <div className="space-y-0">
            {emails.slice(0, 5).map((email) => (
              <EmailCard key={email.id} email={email} projectId={projectId} isNew={newEmailIds.has(email.id)} />
            ))}
          </div>
        ) : (
          <div className="border border-dashed border-border p-4 text-center">
            <p className="text-xs text-muted-foreground">
              {outreachTaskCount > 0
                ? "Preparing outreach..."
                : "No outreach yet. The AI will find leads and send emails."}
            </p>
          </div>
        )}

        <div className="text-[10px] text-muted-foreground">
          {emails.length > 0 ? `+ ${emails.length} email${emails.length !== 1 ? "s" : ""} in the past 24h` : `${emails.length} emails sent`}
        </div>
      </CollapsibleSection>
    </div>
  );
}

// ─── Expandable Email Card ────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  SENT: "text-green-600 bg-green-50 border-green-200",
  FAILED: "text-red-600 bg-red-50 border-red-200",
  BLOCKED: "text-yellow-600 bg-yellow-50 border-yellow-200",
};

function EmailCard({ email, projectId, isNew }: { email: ParsedEmail; projectId: string; isNew?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [body, setBody] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    if (!expanded && body === null) {
      setLoading(true);
      try {
        const full = await api.projects.email(projectId, email.id);
        setBody(full.body);
      } catch {
        setBody("Failed to load email body.");
      }
      setLoading(false);
    }
    setExpanded((prev) => !prev);
  };

  return (
    <div
      className={`py-2.5 border-b border-dashed border-border/50 last:border-0 cursor-pointer rounded-sm ${isNew ? "animate-email-appear" : ""}`}
      onClick={handleToggle}
    >
      <div className="flex items-start gap-2 text-xs">
        <span className="text-primary font-bold shrink-0 mt-0.5">
          {expanded ? "▼" : "→"}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate">{email.subject}</p>
          <div className="flex items-center gap-2">
            <p className="text-[10px] text-muted-foreground truncate">
              To: {email.to}
            </p>
            <span className={`text-[9px] px-1 py-0.5 border font-mono uppercase ${STATUS_BADGE[email.status] || "text-muted-foreground"}`}>
              {email.status}
            </span>
          </div>
        </div>
        <span className="text-[10px] text-muted-foreground shrink-0">
          {formatRelativeTime(email.sentAt)}
        </span>
      </div>
      {expanded && (
        <div className="mt-2 ml-5 p-3 border border-dashed border-border bg-muted/30">
          {loading ? (
            <p className="text-[11px] text-muted-foreground animate-pulse">Loading...</p>
          ) : body ? (
            <pre className="text-[11px] leading-relaxed text-foreground whitespace-pre-wrap font-mono break-words">
              {body}
            </pre>
          ) : (
            <p className="text-[11px] text-muted-foreground italic">No body available.</p>
          )}
        </div>
      )}
    </div>
  );
}
