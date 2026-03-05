import { prisma } from "@onera/database";
import { EmailClient } from "@azure/communication-email";

export async function createDailyReport(data: {
  projectId: string;
  content: string;
  tasksCompleted?: string;
  tasksPlanned?: string;
  metrics?: string;
}) {
  // Calculate day number since project creation using calendar-date arithmetic
  const project = await prisma.project.findUnique({
    where: { id: data.projectId },
    select: { createdAt: true },
  });

  if (!project) {
    throw new Error(`Project not found: ${data.projectId}`);
  }

  // Compare calendar dates to avoid time-of-day sensitivity
  const createdDate = new Date(project.createdAt);
  createdDate.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.floor(
    (today.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  const day = Math.max(1, diffDays + 1);

  return prisma.dailyReport.create({
    data: { ...data, day },
  });
}

export async function getLatestReport(projectId: string) {
  return prisma.dailyReport.findFirst({
    where: { projectId },
    orderBy: { date: "desc" },
  });
}

export async function listReports(projectId: string, limit = 30) {
  return prisma.dailyReport.findMany({
    where: { projectId },
    orderBy: { date: "desc" },
    take: limit,
  });
}

/**
 * Send a daily digest email to the project owner via Azure Email Communication Service.
 * This mirrors Polsia's "morning email" feature where the AI sends
 * the founder a summary of what was accomplished and what's planned.
 */
export async function sendDailyDigestEmail(params: {
  projectId: string;
  projectName: string;
  reportContent: string;
  highlights: string[];
  nextSteps: string[];
  completedCount: number;
  pendingCount: number;
  date: string;
}): Promise<void> {
  const connectionString = process.env.AZURE_EMAIL_CONNECTION_STRING;

  if (!connectionString) {
    console.log(`[sendDailyDigestEmail] AZURE_EMAIL_CONNECTION_STRING not set — skipping email for ${params.projectName}`);
    return;
  }

  // Get the project owner's email and the project's company email
  const project = await prisma.project.findUnique({
    where: { id: params.projectId },
    include: { user: { select: { email: true, name: true } } },
  });

  // Use the company-specific sender if available, otherwise fall back to default
  const senderAddress = project?.companyEmail || (process.env.AZURE_EMAIL_SENDER || "operator@onera.app");

  if (!project?.user?.email) {
    console.warn(`[sendDailyDigestEmail] No email found for project owner of ${params.projectName}`);
    return;
  }

  const ownerName = project.user.name || "Founder";
  const ownerEmail = project.user.email;

  const highlightsList =
    params.highlights.length > 0
      ? params.highlights.map((h) => `<li>${h}</li>`).join("")
      : "<li>Agent loop ran successfully</li>";

  const nextStepsList =
    params.nextSteps.length > 0
      ? params.nextSteps.map((s) => `<li>${s}</li>`).join("")
      : "<li>Continuous agent loop running every 4 hours</li>";

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily Digest: ${params.projectName}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; background: #f9f9f9;">
  <div style="background: white; border-radius: 8px; padding: 32px; border: 1px solid #e5e5e5;">
    <div style="border-bottom: 2px solid #000; padding-bottom: 16px; margin-bottom: 24px;">
      <h1 style="margin: 0; font-size: 20px; font-family: 'JetBrains Mono', monospace, sans-serif;">
        ▶ ONERA OPERATOR
      </h1>
      <p style="margin: 4px 0 0; color: #666; font-size: 13px;">Daily Digest: ${params.date}</p>
    </div>

    <p style="margin: 0 0 24px;">Hi ${ownerName},</p>

    <p style="margin: 0 0 24px;">Here's what your AI operator did for <strong>${params.projectName}</strong> today:</p>

    <div style="background: #f0f9f0; border-left: 3px solid #22c55e; padding: 16px; margin-bottom: 24px;">
      <h3 style="margin: 0 0 12px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">✅ Completed Today</h3>
      <p style="margin: 0 0 8px; color: #555; font-size: 14px;">${params.completedCount} tasks completed</p>
      <ul style="margin: 8px 0 0; padding-left: 20px; font-size: 14px; color: #444;">
        ${highlightsList}
      </ul>
    </div>

    <div style="background: #fafafa; border-left: 3px solid #3b82f6; padding: 16px; margin-bottom: 24px;">
      <h3 style="margin: 0 0 12px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">🎯 Next Steps</h3>
      <p style="margin: 0 0 8px; color: #555; font-size: 14px;">${params.pendingCount} tasks pending</p>
      <ul style="margin: 8px 0 0; padding-left: 20px; font-size: 14px; color: #444;">
        ${nextStepsList}
      </ul>
    </div>

    <div style="background: #fff8f0; border-left: 3px solid #f59e0b; padding: 16px; margin-bottom: 24px;">
      <h3 style="margin: 0 0 12px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">📋 Full Report</h3>
      <pre style="margin: 0; font-size: 12px; white-space: pre-wrap; font-family: 'JetBrains Mono', monospace; color: #444; max-height: 400px; overflow: hidden;">${params.reportContent.substring(0, 2000)}${params.reportContent.length > 2000 ? "\n\n[... view full report on dashboard]" : ""}</pre>
    </div>

    <p style="margin: 0; font-size: 13px; color: #888; text-align: center; border-top: 1px solid #eee; padding-top: 16px;">
      Your AI operator is running 24/7. Reply to this email or use the dashboard to give feedback.<br>
      <a href="${process.env.FRONTEND_URL || "http://localhost:3000"}/dashboard" style="color: #3b82f6;">View Dashboard</a>
    </p>
  </div>
</body>
</html>`;

  try {
    const emailClient = new EmailClient(connectionString);
    const poller = await emailClient.beginSend({
      senderAddress,
      content: {
        subject: `[${params.projectName}] Daily Operator Digest: ${params.date}`,
        html: htmlBody,
        plainText: `Daily Digest for ${params.projectName} | ${params.date}\n\n${params.completedCount} tasks completed today.\n\nHighlights:\n${params.highlights.join("\n")}\n\nNext steps:\n${params.nextSteps.join("\n")}\n\nFull report:\n${params.reportContent.substring(0, 3000)}`,
      },
      recipients: {
        to: [{ address: ownerEmail }],
      },
    });

    const result = await poller.pollUntilDone();

    if (result.status === "Succeeded") {
      console.log(`[sendDailyDigestEmail] Digest sent to ${ownerEmail} for ${params.projectName}`);
    } else {
      console.error("[sendDailyDigestEmail] Azure ECS error:", result.error);
    }
  } catch (err) {
    console.error("[sendDailyDigestEmail] Failed to send digest:", err instanceof Error ? err.message : err);
  }
}
