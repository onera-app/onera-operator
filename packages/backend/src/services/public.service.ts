import { prisma, TaskStatus } from "@onera/database";
import { getModel } from "@onera/ai";
import { generateText } from "ai";

/** Redact PII from a free-text string. */
export function redactText(text: string): string {
  return text
    .replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, (m) => {
      const [local, domain] = m.split("@");
      const tld = domain!.split(".").pop();
      return `${local![0]}***@***.${tld}`;
    })
    .replace(/@[A-Za-z0-9_]{1,15}/g, "@***")
    .replace(/\b\d{3}[\s.\-]?\d{3}[\s.\-]?\d{4}\b/g, "***-***-****")
    .replace(
      /https?:\/\/([a-zA-Z0-9.\-]+)(\/[^\s"')]*)?/g,
      (_m, host: string) => `https://${host}/\u2026`
    );
}

/** Deterministic human-readable slug for a project ID (stable, non-reversible). */
export function projectSlug(projectId: string): string {
  const adjectives = [
    "swift", "bright", "bold", "calm", "deep", "fast", "keen",
    "lean", "neat", "pure", "sharp", "smart", "warm", "wise",
  ];
  const nouns = [
    "falcon", "orbit", "nexus", "forge", "spark", "pulse", "wave",
    "ridge", "grove", "prism", "flare", "haven", "shift", "bloom",
  ];
  let hash = 0;
  for (const ch of projectId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const adj = adjectives[hash % adjectives.length]!;
  const noun = nouns[Math.floor(hash / adjectives.length) % nouns.length]!;
  return `${adj}-${noun}`;
}

export async function getPublicLiveData() {
  const [agents, recentTasks, recentLogs, stats] = await Promise.all([
    prisma.agentStatus.findMany({
      orderBy: { name: "asc" },
      select: {
        name: true,
        displayName: true,
        status: true,
        lastRunAt: true,
        tasksCompleted: true,
      },
    }),

    prisma.task.findMany({
      where: {
        status: { in: [TaskStatus.IN_PROGRESS, TaskStatus.COMPLETED, TaskStatus.FAILED] },
      },
      orderBy: { updatedAt: "desc" },
      take: 30,
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        status: true,
        agentName: true,
        result: true,
        updatedAt: true,
        completedAt: true,
        createdAt: true,
        projectId: true,
      },
    }),

    // Recent execution logs for the terminal feed
    prisma.executionLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        agentName: true,
        action: true,
        status: true,
        createdAt: true,
      },
    }),

    Promise.all([
      prisma.task.count({ where: { status: TaskStatus.COMPLETED } }),
      prisma.task.count({ where: { agentName: "outreach", status: TaskStatus.COMPLETED } }),
      prisma.task.count({ where: { agentName: "twitter", status: TaskStatus.COMPLETED } }),
      prisma.project.count(),
      // Tasks completed in last 24h
      prisma.task.count({
        where: {
          status: TaskStatus.COMPLETED,
          completedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
    ]),
  ]);

  const [totalTasks, emailTasks, tweetTasks, totalProjects, tasksLast24h] = stats;

  // Extract tweets and emails from completed task results
  const tweets: { text: string; postedAt: string }[] = [];
  const emails: { subject: string; to: string; sentAt: string }[] = [];

  for (const task of recentTasks) {
    if (!task.result) continue;
    try {
      const result = JSON.parse(task.result) as Record<string, unknown>;
      const toolResults = (result.toolResults || []) as Array<{
        tool: string;
        result?: Record<string, unknown>;
      }>;

      for (const tr of toolResults) {
        if (tr.tool === "scheduleTweet" && tr.result?.tweet) {
          tweets.push({
            text: redactText(String(tr.result.tweet)),
            postedAt: String(tr.result.scheduledTime || task.completedAt?.toISOString() || task.createdAt.toISOString()),
          });
        }
        if (tr.tool === "sendEmail" && tr.result) {
          emails.push({
            subject: redactText(String(tr.result.subject || "Outreach email")),
            to: redactText(String(tr.result.to || tr.result.recipient || "unknown")),
            sentAt: String(tr.result.sentAt || task.completedAt?.toISOString() || task.createdAt.toISOString()),
          });
        }
      }
    } catch {
      // skip
    }
  }

  const safeTasks = recentTasks.map((t) => ({
    id: t.id,
    title: redactText(t.title),
    description: t.description ? redactText(t.description).slice(0, 200) : null,
    category: t.category,
    status: t.status,
    agentName: t.agentName,
    updatedAt: t.updatedAt.toISOString(),
    completedAt: t.completedAt?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
    projectSlug: projectSlug(t.projectId),
  }));

  // Terminal-style log lines from execution logs
  const terminalLines = recentLogs.map((log) => ({
    text: `[${log.agentName}] ${redactText(log.action)}`,
    status: log.status,
    timestamp: log.createdAt.toISOString(),
  }));

  return {
    agents,
    tasks: safeTasks,
    tweets: tweets.slice(0, 10),
    emails: emails.slice(0, 10),
    terminalLines,
    stats: {
      totalTasksCompleted: totalTasks,
      tasksLast24h,
      emailsSent: emailTasks,
      tweetsPosted: tweetTasks,
      activeProjects: totalProjects,
    },
    hasRealData: recentTasks.length > 0,
  };
}

// ---------------------------------------------------------------------------
// Public "Ask OneraOS" — answers questions about current system state
// ---------------------------------------------------------------------------

/** Simple in-memory rate limiter per IP. */
const askLimiter = new Map<string, { count: number; resetAt: number }>();
const ASK_MAX_PER_MINUTE = 5;

export function checkAskRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = askLimiter.get(ip);
  if (!entry || now > entry.resetAt) {
    askLimiter.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= ASK_MAX_PER_MINUTE) return false;
  entry.count++;
  return true;
}

export async function answerPublicQuestion(question: string): Promise<string> {
  // 1. Gather current system state (reuse getPublicLiveData)
  const live = await getPublicLiveData();

  // 2. Build a concise context snapshot
  const agentSummary = live.agents
    .map((a) => `- ${a.displayName}: ${a.status}${a.tasksCompleted > 0 ? ` (${a.tasksCompleted} tasks done)` : ""}`)
    .join("\n");

  const runningTasks = live.tasks
    .filter((t) => t.status === "IN_PROGRESS")
    .map((t) => `- [${t.category}] ${t.title} (agent: ${t.agentName ?? "unassigned"})`)
    .join("\n");

  const recentCompleted = live.tasks
    .filter((t) => t.status === "COMPLETED")
    .slice(0, 5)
    .map((t) => `- [${t.category}] ${t.title}${t.description ? ": " + t.description.slice(0, 80) : ""}`)
    .join("\n");

  const recentTerminal = live.terminalLines
    .slice(0, 10)
    .map((l) => l.text)
    .join("\n");

  const recentTweets = live.tweets
    .slice(0, 3)
    .map((t) => `- "${t.text.slice(0, 100)}"`)
    .join("\n");

  const recentEmails = live.emails
    .slice(0, 3)
    .map((e) => `- Subject: ${e.subject} → ${e.to}`)
    .join("\n");

  const context = `
## OneraOS System State (live snapshot)

### Stats
- Total tasks completed: ${live.stats.totalTasksCompleted}
- Tasks in last 24h: ${live.stats.tasksLast24h}
- Emails sent: ${live.stats.emailsSent}
- Tweets posted: ${live.stats.tweetsPosted}
- Active projects: ${live.stats.activeProjects}

### Agents
${agentSummary || "No agents registered yet."}

### Currently Running Tasks
${runningTasks || "No tasks running right now."}

### Recently Completed Tasks
${recentCompleted || "No completed tasks yet."}

### Recent Terminal Activity
${recentTerminal || "No recent logs."}

### Recent Tweets
${recentTweets || "No tweets yet."}

### Recent Emails
${recentEmails || "No emails yet."}
`.trim();

  // 3. Call the LLM
  const model = getModel();
  const { text } = await generateText({
    model,
    system: `You are OneraOS, an autonomous AI operating system that runs marketing, outreach, research, and engineering tasks for companies.

You are answering questions on the public /live dashboard. Visitors can see the dashboard and ask you what's going on.

Rules:
- Be concise (2-4 sentences max). Speak in first person as "I" or "we" (the OneraOS system).
- Only answer based on the system state provided below. Do not make up information.
- If nothing is happening, say so honestly. For example: "I'm idle right now, waiting for the next scheduled run."
- Never reveal private details like real company names, emails, API keys, or internal IDs. The data has been redacted; keep it that way.
- Be friendly but professional. You're a live system responding to a curious visitor.
- If the question is unrelated to OneraOS or what you're doing, politely redirect: "I can only tell you about what OneraOS is doing right now."
- NEVER use dashes (--), em-dashes, or en-dashes. Use periods, commas, or colons instead.

${context}`,
    prompt: question,
    maxTokens: 800,
  });

  return text.trim();
}
