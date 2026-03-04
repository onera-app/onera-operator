"use client";

import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { api, type Task, type ExecutionLog } from "@/lib/api-client";
import { formatRelativeTime } from "@/lib/utils";

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
      // Get completed twitter tasks to extract generated tweets
      const tasks = await api.tasks.list({ projectId });

      const twitterTasks = tasks.filter(
        (t) => t.agentName === "twitter" && t.status === "COMPLETED" && t.result
      );
      const outreachTasks = tasks.filter(
        (t) => t.agentName === "outreach" && t.status === "COMPLETED" && t.result
      );

      setTwitterTaskCount(
        tasks.filter((t) => t.agentName === "twitter").length
      );
      setOutreachTaskCount(
        tasks.filter((t) => t.agentName === "outreach").length
      );

      // Extract tweets from task results
      const parsedTweets: ParsedTweet[] = [];
      for (const task of twitterTasks) {
        try {
          const result = JSON.parse(task.result!);
          const toolResults = result.toolResults || [];
          for (const tr of toolResults) {
            if (tr.tool === "scheduleTweet" && tr.result?.tweet) {
              parsedTweets.push({
                text: tr.result.tweet,
                scheduledTime: tr.result.scheduledTime || task.completedAt || task.createdAt,
              });
            }
          }
        } catch {
          // skip unparseable results
        }
      }
      setTweets(parsedTweets);

      // Extract emails from outreach task results
      const parsedEmails: ParsedEmail[] = [];
      for (const task of outreachTasks) {
        try {
          const result = JSON.parse(task.result!);
          const toolResults = result.toolResults || [];
          for (const tr of toolResults) {
            if (tr.tool === "sendEmail" && tr.result) {
              parsedEmails.push({
                subject: tr.result.subject || "Outreach email",
                to: tr.result.to || tr.result.recipient || "unknown",
                sentAt: tr.result.sentAt || task.completedAt || task.createdAt,
              });
            }
          }
        } catch {
          // skip
        }
      }
      setEmails(parsedEmails);
    } catch (err) {
      console.error("Failed to fetch activity data:", err);
    }
  }, [projectId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 8000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <div className="space-y-5">
      {/* Twitter section */}
      <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        Twitter
      </h3>

      <div className="text-[10px] text-muted-foreground mb-1">
        @oneraos
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

      {/* Separator */}
      <div className="border-t border-dashed border-border" />

      {/* Email section */}
      <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        Email Outreach
      </h3>

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
    </div>
  );
}
