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

  const dashboardUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/dashboard`;

  const highlightItems =
    params.highlights.length > 0
      ? params.highlights
      : ["Agent loop ran successfully"];

  const nextStepItems =
    params.nextSteps.length > 0
      ? params.nextSteps
      : ["Continuous loop running every 4 hours"];

  const shippedList = highlightItems.map((h) => `* ${h}`).join("<br>");
  const nextList = nextStepItems.map((s, i) => `${i + 1}. ${s}`).join("<br>");

  const htmlBody = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; color: #1a1a1a; line-height: 1.65;">
  <div style="max-width: 560px; padding: 20px;">
    Hey ${ownerName},<br><br>
    Here's what happened with <strong>${params.projectName}</strong> today. ${params.completedCount} tasks done, ${params.pendingCount} queued up for next cycle.<br><br>
    <strong>Shipped</strong><br>
    ${shippedList}<br><br>
    <strong>Up next</strong><br>
    ${nextList}<br><br>
    <a href="${dashboardUrl}" style="color: #0033CC;"><strong>Open your dashboard</strong></a> for the full report.<br><br>
    <span style="color: #999;">&mdash; Onera Operator (Shipping &amp; Operating)</span><br><br>
    <pre style="font-family: 'Courier New', monospace; font-size: 13px; line-height: 1.3; color: #1a1a1a; margin: 0;">  +-------+
  | ^   ^ |  /&#x1F680;
  |   o   | /
  | \___/ |
  +-------+</pre><br>
    <a href="${dashboardUrl}" style="color: #0033CC; font-size: 13px;">View Dashboard &rarr;</a>
  </div>
</body>
</html>`;

  try {
    const emailClient = new EmailClient(connectionString);
    const poller = await emailClient.beginSend({
      senderAddress,
      content: {
        subject: `[${params.projectName}] Here's what happened today`,
        html: htmlBody,
        plainText: `Hey ${ownerName},\n\nHere's what happened with ${params.projectName} today. ${params.completedCount} tasks done, ${params.pendingCount} queued up.\n\nShipped:\n${highlightItems.map((h) => `  * ${h}`).join("\n")}\n\nUp next:\n${nextStepItems.map((s, i) => `  ${i + 1}. ${s}`).join("\n")}\n\nOpen your dashboard for the full report: ${dashboardUrl}\n\n— Onera Operator (Shipping & Operating)\n\n  +-------+\n  | ^   ^ |  /🚀\n  |   o   | /\n  | \\___/ |\n  +-------+`,
      },
      recipients: {
        to: [{ address: ownerEmail }],
      },
      replyTo: [{ address: ownerEmail }],
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
