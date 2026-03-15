"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { api, type QueuedTweet } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/utils";

type StatusFilter = "PENDING" | "POSTED" | "DELETED" | "ALL";
const PAGE_SIZE = 15;

export default function AdminTweetsPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [tweets, setTweets] = useState<QueuedTweet[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<StatusFilter>("PENDING");
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  // Tweet URL input state — tracks which tweet is having its URL edited
  const [urlEditingId, setUrlEditingId] = useState<string | null>(null);
  const [urlEditValue, setUrlEditValue] = useState("");

  // Check admin access
  useEffect(() => {
    if (isLoaded && user) {
      const role = (user.publicMetadata as Record<string, unknown>)?.role;
      if (role !== "admin") {
        router.push("/dashboard");
      }
    }
  }, [isLoaded, user, router]);

  const fetchTweets = useCallback(async () => {
    try {
      const filters: { status?: string; page?: number; limit?: number } = {
        page,
        limit: PAGE_SIZE,
      };
      if (filter !== "ALL") filters.status = filter;
      const data = await api.admin.tweets.list(filters);
      setTweets(data.tweets);
      setTotal(data.total);
    } catch (err) {
      console.error("Failed to fetch tweets:", err);
    } finally {
      setLoading(false);
    }
  }, [filter, page]);

  useEffect(() => {
    setLoading(true);
    fetchTweets();
  }, [fetchTweets]);

  // Reset to page 1 when filter changes
  useEffect(() => {
    setPage(1);
  }, [filter]);

  const handleMarkPosted = async (id: string) => {
    setActionLoading(id);
    try {
      await api.admin.tweets.update(id, { status: "POSTED" });
      await fetchTweets();
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    setActionLoading(id);
    try {
      await api.admin.tweets.update(id, { status: "DELETED" });
      await fetchTweets();
    } finally {
      setActionLoading(null);
    }
  };

  const handleRegenerate = async (id: string) => {
    setActionLoading(id);
    try {
      await api.admin.tweets.regenerate(id);
      await fetchTweets();
    } finally {
      setActionLoading(null);
    }
  };

  const handleSaveEdit = async (id: string) => {
    if (editContent.length > 280) return;
    setActionLoading(id);
    try {
      await api.admin.tweets.update(id, { content: editContent });
      setEditingId(null);
      await fetchTweets();
    } finally {
      setActionLoading(null);
    }
  };

  const startEdit = (tweet: QueuedTweet) => {
    setEditingId(tweet.id);
    setEditContent(tweet.content);
  };

  const openXIntent = (content: string) => {
    const url = `https://x.com/intent/tweet?text=${encodeURIComponent(content)}`;
    window.open(url, "_blank");
  };

  const startUrlEdit = (tweet: QueuedTweet) => {
    setUrlEditingId(tweet.id);
    setUrlEditValue(tweet.tweetUrl || "");
  };

  const handleSaveUrl = async (id: string) => {
    setActionLoading(id);
    try {
      await api.admin.tweets.update(id, { tweetUrl: urlEditValue.trim() });
      setUrlEditingId(null);
      await fetchTweets();
    } finally {
      setActionLoading(null);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  if (!isLoaded || !user) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="text-xs text-muted-foreground uppercase tracking-wider animate-pulse">
          Loading...
        </span>
      </div>
    );
  }

  const role = (user.publicMetadata as Record<string, unknown>)?.role;
  if (role !== "admin") return null;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-2xl font-bold">Tweet Queue</h1>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Review AI-generated tweets and post them manually on X. Latest tweets shown first.
        </p>
      </div>

      {/* Status filter tabs */}
      <div className="flex items-center gap-2 mb-6 border-b border-dashed border-border pb-3">
        {(["PENDING", "POSTED", "DELETED", "ALL"] as StatusFilter[]).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={filter === s ? "default" : "outline"}
            onClick={() => setFilter(s)}
            className={
              filter === s
                ? ""
                : "border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary"
            }
          >
            {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
          </Button>
        ))}
        <span className="ml-auto text-[10px] text-muted-foreground font-mono">
          {total} tweet{total !== 1 ? "s" : ""}
          {totalPages > 1 && ` · page ${page}/${totalPages}`}
        </span>
      </div>

      {/* Tweet list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <span className="text-xs text-muted-foreground animate-pulse">Loading tweets...</span>
        </div>
      ) : tweets.length === 0 ? (
        <div className="border border-dashed border-border p-8 text-center">
          <p className="text-xs text-muted-foreground">
            No {filter !== "ALL" ? filter.toLowerCase() : ""} tweets in the queue.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {tweets.map((tweet) => (
            <div
              key={tweet.id}
              className="border border-dashed border-border p-4 space-y-3 relative"
            >
              {/* Project name + status badge */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">
                  {tweet.project?.name || "Unknown Project"}
                </span>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      tweet.status === "PENDING"
                        ? "outline"
                        : tweet.status === "POSTED"
                          ? "default"
                          : "secondary"
                    }
                  >
                    {tweet.status}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {tweet.tone}
                  </span>
                </div>
              </div>

              {/* Tweet content or edit mode */}
              {editingId === tweet.id ? (
                <div className="space-y-2">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full bg-background border border-border p-3 text-xs leading-relaxed font-mono resize-none focus:outline-none focus:border-primary"
                    rows={4}
                    maxLength={280}
                  />
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[10px] font-mono ${
                        editContent.length > 280
                          ? "text-destructive"
                          : "text-muted-foreground"
                      }`}
                    >
                      {editContent.length}/280
                    </span>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleSaveEdit(tweet.id)}
                        disabled={editContent.length > 280 || actionLoading === tweet.id}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-xs leading-relaxed">{tweet.content}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {tweet.content.length}/280
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatRelativeTime(tweet.generatedAt)}
                      </span>
                      {tweet.postedAt && (
                        <span className="text-[10px] text-muted-foreground">
                          Posted {formatRelativeTime(tweet.postedAt)}
                        </span>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Tweet URL — show link if set, or edit input */}
              {urlEditingId === tweet.id ? (
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[10px] text-muted-foreground font-mono shrink-0">URL:</span>
                  <input
                    type="url"
                    value={urlEditValue}
                    onChange={(e) => setUrlEditValue(e.target.value)}
                    placeholder="https://x.com/onerachat/status/..."
                    className="flex-1 bg-background border border-dashed border-border px-2 py-1 text-[11px] font-mono focus:outline-none focus:border-primary"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-[10px]"
                    onClick={() => setUrlEditingId(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="h-6 px-2 text-[10px]"
                    onClick={() => handleSaveUrl(tweet.id)}
                    disabled={actionLoading === tweet.id}
                  >
                    Save
                  </Button>
                </div>
              ) : tweet.tweetUrl ? (
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[10px] text-muted-foreground font-mono shrink-0">URL:</span>
                  <a
                    href={tweet.tweetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-primary underline underline-offset-2 hover:text-primary/80 font-mono truncate"
                  >
                    {tweet.tweetUrl}
                  </a>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-5 px-1 text-[9px] text-muted-foreground hover:text-primary"
                    onClick={() => startUrlEdit(tweet)}
                  >
                    [edit]
                  </Button>
                </div>
              ) : null}

              {/* Actions */}
              {editingId !== tweet.id && (
                <div className="flex items-center gap-2 pt-1 border-t border-dashed border-border/50">
                  {tweet.status === "PENDING" && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => openXIntent(tweet.content)}
                      >
                        Post on X
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleMarkPosted(tweet.id)}
                        disabled={actionLoading === tweet.id}
                      >
                        Mark as Posted
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => startEdit(tweet)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => startUrlEdit(tweet)}
                      >
                        Add URL
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRegenerate(tweet.id)}
                        disabled={actionLoading === tweet.id}
                      >
                        Regenerate
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(tweet.id)}
                        disabled={actionLoading === tweet.id}
                      >
                        Delete
                      </Button>
                    </>
                  )}
                  {tweet.status === "POSTED" && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">
                        Posted by admin
                      </span>
                      {!tweet.tweetUrl && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-[10px]"
                          onClick={() => startUrlEdit(tweet)}
                        >
                          Add Tweet URL
                        </Button>
                      )}
                    </div>
                  )}
                  {tweet.status === "DELETED" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRegenerate(tweet.id)}
                      disabled={actionLoading === tweet.id}
                    >
                      Restore &amp; Regenerate
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-dashed border-border">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="border-dashed"
          >
            &larr; Prev
          </Button>
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => {
                // Show first, last, and pages near current
                if (p === 1 || p === totalPages) return true;
                if (Math.abs(p - page) <= 2) return true;
                return false;
              })
              .reduce<(number | "...")[]>((acc, p, i, arr) => {
                if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("...");
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === "..." ? (
                  <span key={`dots-${i}`} className="text-[10px] text-muted-foreground px-1">...</span>
                ) : (
                  <Button
                    key={p}
                    size="sm"
                    variant={p === page ? "default" : "ghost"}
                    onClick={() => setPage(p as number)}
                    className={p === page ? "" : "text-muted-foreground font-mono text-[10px]"}
                  >
                    {p}
                  </Button>
                )
              )}
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="border-dashed"
          >
            Next &rarr;
          </Button>
        </div>
      )}
    </div>
  );
}
