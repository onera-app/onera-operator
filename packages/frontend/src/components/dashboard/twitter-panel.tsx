"use client";

import { useEffect, useState, useCallback } from "react";
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
  subject: string;
  to: string;
  sentAt: string;
}

export function TwitterPanel({ projectId }: TwitterPanelProps) {
  const [tweets, setTweets] = useState<ParsedTweet[]>([]);
  const [emails, setEmails] = useState<ParsedEmail[]>([]);
  const [twitterTaskCount, setTwitterTaskCount] = useState(0);
  const [outreachTaskCount, setOutreachTaskCount] = useState(0);

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
        subject: e.subject,
        to: e.toEmail,
        sentAt: e.sentAt,
      }));
      setEmails(parsedEmails);
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
            {emails.slice(0, 5).map((email, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-xs py-2.5 border-b border-dashed border-border/50 last:border-0"
              >
                <span className="text-primary font-bold shrink-0 mt-0.5">
                  &rarr;
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">
                    {email.subject}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    To: {email.to}
                  </p>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {formatRelativeTime(email.sentAt)}
                </span>
              </div>
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
