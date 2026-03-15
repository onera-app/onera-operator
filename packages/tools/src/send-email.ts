import { tool } from "ai";
import { z } from "zod";
import { EmailClient } from "@azure/communication-email";
import { prisma } from "@onera/database";
import { createId } from "@paralleldrive/cuid2";

// ---------------------------------------------------------------------------
// Message-ID generation — RFC 5322 compliant
// ---------------------------------------------------------------------------

function generateMessageId(): string {
  return `<${createId()}@onera.app>`;
}

// ---------------------------------------------------------------------------
// Contact + Conversation auto-creation helpers
// ---------------------------------------------------------------------------

async function findOrCreateContact(opts: {
  projectId: string;
  email: string;
  name?: string;
  company?: string;
  role?: string;
  companyUrl?: string;
}) {
  try {
    const existing = await prisma.contact.findUnique({
      where: { projectId_email: { projectId: opts.projectId, email: opts.email } },
    });
    if (existing) {
      // Update contact info if we have new data
      if (opts.name || opts.company || opts.role || opts.companyUrl) {
        return await prisma.contact.update({
          where: { id: existing.id },
          data: {
            ...(opts.name && !existing.name && { name: opts.name }),
            ...(opts.company && !existing.company && { company: opts.company }),
            ...(opts.role && !existing.role && { role: opts.role }),
            ...(opts.companyUrl && !existing.companyUrl && { companyUrl: opts.companyUrl }),
          },
        });
      }
      return existing;
    }
    return await prisma.contact.create({
      data: {
        projectId: opts.projectId,
        email: opts.email,
        name: opts.name,
        company: opts.company,
        role: opts.role,
        companyUrl: opts.companyUrl,
        source: "OUTREACH",
      },
    });
  } catch (err) {
    console.warn("[sendEmail] Failed to find/create contact:", err instanceof Error ? err.message : err);
    return null;
  }
}

async function findOrCreateConversation(opts: {
  projectId: string;
  contactId: string;
  subject: string;
}) {
  try {
    // Normalize subject for matching (strip Re:, Fwd:, etc.)
    const normalizedSubject = opts.subject
      .replace(/^(re|fwd|fw):\s*/gi, "")
      .trim();

    // Look for existing conversation with same contact and similar subject
    const existing = await prisma.emailConversation.findFirst({
      where: {
        projectId: opts.projectId,
        contactId: opts.contactId,
        subject: { contains: normalizedSubject, mode: "insensitive" },
      },
      orderBy: { lastActivityAt: "desc" },
    });

    if (existing) {
      // Update activity
      return await prisma.emailConversation.update({
        where: { id: existing.id },
        data: {
          lastActivityAt: new Date(),
          messageCount: { increment: 1 },
        },
      });
    }

    return await prisma.emailConversation.create({
      data: {
        projectId: opts.projectId,
        contactId: opts.contactId,
        subject: normalizedSubject,
        status: "ACTIVE",
        messageCount: 1,
      },
    });
  } catch (err) {
    console.warn("[sendEmail] Failed to find/create conversation:", err instanceof Error ? err.message : err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Email logging — persists every send attempt to the database for audit
// ---------------------------------------------------------------------------

async function logEmail(opts: {
  projectId?: string;
  fromEmail: string;
  toEmail: string;
  replyTo?: string;
  subject: string;
  body: string;
  htmlBody?: string;
  status: "SENT" | "FAILED" | "BLOCKED";
  azureMessageId?: string;
  messageId?: string;
  inReplyTo?: string;
  references?: string;
  conversationId?: string;
  contactId?: string;
  direction?: "OUTBOUND" | "INBOUND";
  errorMessage?: string;
  type?: "OUTREACH" | "DIGEST" | "NOTIFICATION" | "FOLLOW_UP" | "REPLY";
}) {
  if (!opts.projectId) return; // Can't log without a project
  try {
    await prisma.emailLog.create({
      data: {
        projectId: opts.projectId,
        fromEmail: opts.fromEmail,
        toEmail: opts.toEmail,
        replyTo: opts.replyTo,
        subject: opts.subject,
        body: opts.body,
        htmlBody: opts.htmlBody,
        status: opts.status,
        azureMessageId: opts.azureMessageId,
        messageId: opts.messageId,
        inReplyTo: opts.inReplyTo,
        references: opts.references,
        conversationId: opts.conversationId,
        contactId: opts.contactId,
        direction: opts.direction || "OUTBOUND",
        deliveryStatus: opts.status === "SENT" ? "PENDING" : "FAILED",
        errorMessage: opts.errorMessage,
        type: opts.type || "OUTREACH",
      },
    });
  } catch (err) {
    // Don't let logging failures break email sending
    console.warn("[sendEmail] Failed to log email to DB:", err instanceof Error ? err.message : err);
  }
}

/**
 * Converts plain-text email body into minimal HTML.
 * Just preserves paragraph breaks. No fancy styling.
 */
function toCleanHtml(body: string): string {
  const html = body
    .split("\n\n")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => p.replace(/\n/g, "<br>"))
    .join("<br><br>");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; color: #1a1a1a; line-height: 1.65;">
  <div style="max-width: 560px; padding: 20px;">
    ${html}
  </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Email Quality Gate — validates email content before sending
// ---------------------------------------------------------------------------

interface QualityCheckResult {
  pass: boolean;
  failures: string[];
}

/**
 * Validates an email against quality rules before it leaves the system.
 * Returns a list of failures. If the list is empty the email is safe to send.
 */
function validateEmail(subject: string, body: string, to: string): QualityCheckResult {
  const failures: string[] = [];
  const lowerBody = body.toLowerCase();

  // 1. Subject must not be empty or too generic
  if (!subject || subject.trim().length < 5) {
    failures.push("Subject line is missing or too short (min 5 chars).");
  }

  // 2. Body must not be too short (likely incomplete)
  if (!body || body.trim().length < 50) {
    failures.push("Email body is too short (min 50 chars). Likely incomplete.");
  }

  // 3. Must contain some form of sign-off (indicates a complete, professional email)
  //    Relaxed: also accept name+title endings (e.g. "Shreyas\nCOO, CompanyName")
  const signOffPatterns = [
    "best regards", "best,", "regards,", "thanks,", "thank you",
    "cheers,", "sincerely,", "warm regards", "looking forward",
    "talk soon", "kind regards", "all the best",
  ];
  const hasSignOff = signOffPatterns.some((p) => lowerBody.includes(p));
  // Also accept a name + role/company block at the end (common in cold outreach)
  const lastLines = body.trim().split("\n").slice(-4).join("\n").toLowerCase();
  const hasNameBlock = /\b(coo|ceo|cto|founder|co-founder|director|vp|head of)\b/.test(lastLines);
  if (!hasSignOff && !hasNameBlock) {
    failures.push("Missing sign-off. Email must end professionally (e.g. 'Best regards, ...' or Name + Title).");
  }

  // 4. Must mention a company name / URL (not a vague anonymous email)
  //    We check for URL patterns or common domain indicators
  const hasUrl = /https?:\/\/\S+/i.test(body) || /\w+\.\w{2,}/.test(body);
  if (!hasUrl) {
    failures.push("No company URL found in the email. Every outreach email must include the sender's company URL.");
  }

  // 5. Must not contain placeholder tokens the LLM forgot to fill
  const placeholderPatterns = [
    /\[your .*?\]/i,
    /\[company .*?\]/i,
    /\[insert .*?\]/i,
    /\[name\]/i,
    /\[url\]/i,
    /\{your .*?\}/i,
    /\{company .*?\}/i,
    /<your .*?>/i,
    /<company .*?>/i,
  ];
  for (const pattern of placeholderPatterns) {
    if (pattern.test(body) || pattern.test(subject)) {
      failures.push(`Found unfilled placeholder: ${body.match(pattern)?.[0] || subject.match(pattern)?.[0]}`);
      break; // one is enough
    }
  }

  // 6. Recipient must be a real-looking email (not test/example)
  const testDomains = ["example.com", "test.com", "localhost", "mailinator.com"];
  const recipientDomain = to.split("@")[1]?.toLowerCase();
  if (recipientDomain && testDomains.includes(recipientDomain)) {
    failures.push(`Recipient domain "${recipientDomain}" looks like a test address. Refusing to send.`);
  }

  // 7. Body should not be excessively long (likely dump, not a crafted email)
  if (body.length > 5000) {
    failures.push("Email body exceeds 5000 chars. Outreach emails should be concise.");
  }

  return { pass: failures.length === 0, failures };
}

/**
 * Core send function used by both sendEmail and sendFollowUp tools.
 * Handles quality gate, Azure ECS dispatch, contact/conversation creation, and logging.
 */
export async function sendEmailCore(params: {
  to: string;
  subject: string;
  body: string;
  from?: string;
  replyTo?: string;
  html?: string;
  projectId?: string;
  // Threading
  inReplyTo?: string;
  references?: string;
  conversationId?: string;
  // Contact info for auto-creation
  recipientName?: string;
  recipientCompany?: string;
  recipientRole?: string;
  recipientCompanyUrl?: string;
  // Type override
  emailType?: "OUTREACH" | "FOLLOW_UP" | "REPLY" | "DIGEST" | "NOTIFICATION";
}) {
  const {
    to, subject, body, replyTo, html: rawHtml, projectId,
    inReplyTo, references, recipientName, recipientCompany,
    recipientRole, recipientCompanyUrl, emailType,
  } = params;
  const from = params.from || undefined;

  // ── Quality Gate ──────────────────────────────────────────────────
  const validation = validateEmail(subject, body, to);

  if (!validation.pass) {
    console.warn(
      `[sendEmail] BLOCKED — email to ${to} failed quality checks:\n` +
      validation.failures.map((f) => `  - ${f}`).join("\n")
    );
    await logEmail({
      projectId,
      fromEmail: from || "operator@onera.app",
      toEmail: to,
      replyTo,
      subject,
      body,
      status: "BLOCKED",
      errorMessage: validation.failures.join("; "),
      type: emailType || "OUTREACH",
    });
    return {
      status: "rejected",
      to,
      subject,
      bodyPreview: body.substring(0, 200),
      reason: "Email did not pass quality validation. Fix the issues and try again.",
      failures: validation.failures,
    };
  }

  // ── Auto-create contact & conversation ──────────────────────────
  let contactId: string | undefined;
  let conversationId = params.conversationId;

  if (projectId) {
    const contact = await findOrCreateContact({
      projectId,
      email: to,
      name: recipientName,
      company: recipientCompany,
      role: recipientRole,
      companyUrl: recipientCompanyUrl,
    });
    if (contact) {
      contactId = contact.id;
      if (!conversationId) {
        const conversation = await findOrCreateConversation({
          projectId,
          contactId: contact.id,
          subject,
        });
        if (conversation) {
          conversationId = conversation.id;
        }
      } else {
        // Update existing conversation activity
        try {
          await prisma.emailConversation.update({
            where: { id: conversationId },
            data: {
              lastActivityAt: new Date(),
              messageCount: { increment: 1 },
            },
          });
        } catch { /* ignore */ }
      }
    }
  }

  // ── Generate Message-ID ─────────────────────────────────────────
  const messageId = generateMessageId();

  // ── Build References header chain ───────────────────────────────
  let fullReferences = references || "";
  if (inReplyTo) {
    fullReferences = fullReferences ? `${fullReferences} ${inReplyTo}` : inReplyTo;
  }

  // ── Environment check ─────────────────────────────────────────────
  const connectionString = process.env.AZURE_EMAIL_CONNECTION_STRING;
  const senderAddress = from || process.env.AZURE_EMAIL_SENDER || "operator@onera.app";

  if (!connectionString) {
    console.log(
      `[sendEmail] AZURE_EMAIL_CONNECTION_STRING not set — would send:\n  To: ${to}\n  Subject: ${subject}\n  Body: ${body.substring(0, 200)}...`
    );
    await logEmail({
      projectId,
      fromEmail: senderAddress,
      toEmail: to,
      replyTo,
      subject,
      body,
      messageId,
      inReplyTo,
      references: fullReferences || undefined,
      conversationId,
      contactId,
      status: "SENT",
      type: emailType || "OUTREACH",
    });
    return {
      status: "queued",
      to,
      subject,
      messageId,
      conversationId,
      bodyPreview: body.substring(0, 100) + (body.length > 100 ? "..." : ""),
      message:
        "Email logged (not sent). Set AZURE_EMAIL_CONNECTION_STRING to enable live sending.",
    };
  }

  // ── Send via Azure ECS ────────────────────────────────────────────
  try {
    const emailClient = new EmailClient(connectionString);

    const htmlBody = rawHtml || toCleanHtml(body);

    const message = {
      senderAddress,
      content: {
        subject,
        plainText: body,
        html: htmlBody,
      },
      recipients: {
        to: [{ address: to }],
      },
      ...(replyTo && {
        replyTo: [{ address: replyTo }],
      }),
      headers: {
        "Message-ID": messageId,
        ...(inReplyTo && { "In-Reply-To": inReplyTo }),
        ...(fullReferences && { References: fullReferences }),
      },
    };

    const poller = await emailClient.beginSend(message);
    const result = await poller.pollUntilDone();

    if (result.status === "Succeeded") {
      console.log(`[sendEmail] Email sent to ${to} (id: ${result.id}, msgId: ${messageId})`);
      await logEmail({
        projectId,
        fromEmail: senderAddress,
        toEmail: to,
        replyTo,
        subject,
        body,
        htmlBody,
        status: "SENT",
        azureMessageId: result.id,
        messageId,
        inReplyTo,
        references: fullReferences || undefined,
        conversationId,
        contactId,
        type: emailType || "OUTREACH",
      });
      return {
        status: "sent",
        to,
        subject,
        messageId,
        conversationId,
        azureMessageId: result.id,
        bodyPreview: body.substring(0, 100) + (body.length > 100 ? "..." : ""),
      };
    } else {
      const errorMsg = result.error?.message || `Send status: ${result.status}`;
      console.error(`[sendEmail] Azure ECS error: status=${result.status}`, result.error);
      await logEmail({
        projectId,
        fromEmail: senderAddress,
        toEmail: to,
        replyTo,
        subject,
        body,
        status: "FAILED",
        errorMessage: errorMsg,
        messageId,
        conversationId,
        contactId,
        type: emailType || "OUTREACH",
      });
      return {
        status: "failed",
        to,
        subject,
        error: errorMsg,
      };
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[sendEmail] Failed to send email:", errMsg);
    await logEmail({
      projectId,
      fromEmail: senderAddress,
      toEmail: to,
      replyTo,
      subject,
      body,
      status: "FAILED",
      errorMessage: errMsg,
      messageId,
      conversationId,
      contactId,
      type: emailType || "OUTREACH",
    });
    return {
      status: "failed",
      to,
      subject,
      error: errMsg,
    };
  }
}

/**
 * Send Email Tool — uses Azure Email Communication Service for delivery.
 *
 * Includes a quality gate that validates every email before sending.
 * Requires AZURE_EMAIL_CONNECTION_STRING environment variable.
 * Sender address: operator@onera.app
 * Falls back to a logged mock when the connection string is not configured.
 *
 * Now includes email threading support:
 * - Generates RFC 5322 Message-ID for every outbound email
 * - Auto-creates Contact and EmailConversation records
 * - Supports In-Reply-To and References headers for threading
 */
export const sendEmail = tool({
  description:
    "Send an email to a recipient. Every email is validated against quality checks before sending. " +
    "The email MUST include the sender's company name and URL, mention the recipient's company, " +
    "have a professional sign-off, and contain no placeholder text. " +
    "IMPORTANT: Always set the 'from' parameter to the company email from the startup context " +
    "(e.g. companyname@onera.app). This ensures emails come from the company's own address. " +
    "Requires AZURE_EMAIL_CONNECTION_STRING to be configured for live sending. " +
    "This tool automatically tracks contacts and creates conversation threads.",
  inputSchema: z.object({
    to: z.string().describe("Recipient email address (e.g. user@example.com)"),
    subject: z.string().describe("Email subject line"),
    body: z.string().describe("Email body content (plain text or markdown)"),
    from: z
      .string()
      .describe(
        "Sender email address. Use the Company Email from the startup context (e.g. companyname@onera.app). " +
        "Use an empty string to default to operator@onera.app."
      ),
    replyTo: z.string().describe("Reply-to email address. Use an empty string if not needed."),
    html: z.string().describe("HTML body content. Use an empty string to auto-generate from plain text body."),
    projectId: z.string().describe("The project ID for tracking. Extract from startup context or use an empty string."),
    recipientName: z.string().describe("Recipient's name (e.g. 'John Smith'). Use empty string if unknown."),
    recipientCompany: z.string().describe("Recipient's company name (e.g. 'Acme Corp'). Use empty string if unknown."),
    recipientRole: z.string().describe("Recipient's role (e.g. 'CEO', 'CTO'). Use empty string if unknown."),
    recipientCompanyUrl: z.string().describe("Recipient's company URL. Use empty string if unknown."),
  }),
  execute: async ({
    to, subject, body, from: rawFrom, replyTo: rawReplyTo, html: rawHtml,
    projectId: rawProjectId, recipientName: rawName, recipientCompany: rawCompany,
    recipientRole: rawRole, recipientCompanyUrl: rawUrl,
  }) => {
    return sendEmailCore({
      to,
      subject,
      body,
      from: rawFrom.length > 0 ? rawFrom : undefined,
      replyTo: rawReplyTo.length > 0 ? rawReplyTo : undefined,
      html: rawHtml.length > 0 ? rawHtml : undefined,
      projectId: rawProjectId.length > 0 ? rawProjectId : undefined,
      recipientName: rawName.length > 0 ? rawName : undefined,
      recipientCompany: rawCompany.length > 0 ? rawCompany : undefined,
      recipientRole: rawRole.length > 0 ? rawRole : undefined,
      recipientCompanyUrl: rawUrl.length > 0 ? rawUrl : undefined,
    });
  },
});
