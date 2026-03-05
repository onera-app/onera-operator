import { tool } from "ai";
import { z } from "zod";
import { EmailClient } from "@azure/communication-email";

/**
 * Converts plain-text email body into clean, professional inline-styled HTML.
 * Preserves paragraph breaks, handles sign-off blocks, and keeps it minimal.
 */
function toCleanHtml(body: string): string {
  const paragraphs = body
    .split("\n\n")
    .map((para) => para.trim())
    .filter(Boolean)
    .map((para) => {
      const html = para.replace(/\n/g, "<br>");
      return `<p style="margin: 0 0 16px; line-height: 1.6;">${html}</p>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background: #f7f7f7;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #f7f7f7;">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background: #ffffff; border-radius: 4px; border: 1px solid #e5e5e5;">
          <tr>
            <td style="padding: 32px 40px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 15px; color: #1a1a1a;">
              ${paragraphs}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
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
  const signOffPatterns = [
    "best regards", "best,", "regards,", "thanks,", "thank you",
    "cheers,", "sincerely,", "warm regards", "looking forward",
    "talk soon", "kind regards",
  ];
  const hasSignOff = signOffPatterns.some((p) => lowerBody.includes(p));
  if (!hasSignOff) {
    failures.push("Missing sign-off. Email must end professionally (e.g. 'Best regards, ...').");
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
 * Send Email Tool — uses Azure Email Communication Service for delivery.
 *
 * Includes a quality gate that validates every email before sending.
 * Requires AZURE_EMAIL_CONNECTION_STRING environment variable.
 * Sender address: operator@onera.app
 * Falls back to a logged mock when the connection string is not configured.
 */
export const sendEmail = tool({
  description:
    "Send an email to a recipient. Every email is validated against quality checks before sending. " +
    "The email MUST include the sender's company name and URL, mention the recipient's company, " +
    "have a professional sign-off, and contain no placeholder text. " +
    "IMPORTANT: Always set the 'from' parameter to the company email from the startup context " +
    "(e.g. companyname@onera.app). This ensures emails come from the company's own address. " +
    "Requires AZURE_EMAIL_CONNECTION_STRING to be configured for live sending.",
  parameters: z.object({
    to: z.string().email().describe("Recipient email address"),
    subject: z.string().describe("Email subject line"),
    body: z.string().describe("Email body content (plain text or markdown)"),
    from: z
      .string()
      .email()
      .optional()
      .describe(
        "Sender email address. Use the Company Email from the startup context (e.g. companyname@onera.app). " +
        "Falls back to operator@onera.app if not provided."
      ),
    replyTo: z.string().email().optional().describe("Reply-to address"),
    html: z.string().optional().describe("Optional HTML body (overrides plain text body)"),
  }),
  execute: async ({ to, subject, body, from, replyTo, html }) => {
    // ── Quality Gate ──────────────────────────────────────────────────
    const validation = validateEmail(subject, body, to);

    if (!validation.pass) {
      console.warn(
        `[sendEmail] BLOCKED — email to ${to} failed quality checks:\n` +
        validation.failures.map((f) => `  - ${f}`).join("\n")
      );
      return {
        status: "rejected",
        to,
        subject,
        bodyPreview: body.substring(0, 200),
        reason: "Email did not pass quality validation. Fix the issues and try again.",
        failures: validation.failures,
      };
    }

    // ── Environment check ─────────────────────────────────────────────
    const connectionString = process.env.AZURE_EMAIL_CONNECTION_STRING;
    const senderAddress = from || process.env.AZURE_EMAIL_SENDER || "operator@onera.app";

    if (!connectionString) {
      console.log(
        `[sendEmail] AZURE_EMAIL_CONNECTION_STRING not set — would send:\n  To: ${to}\n  Subject: ${subject}\n  Body: ${body.substring(0, 200)}...`
      );
      return {
        status: "queued",
        to,
        subject,
        bodyPreview: body.substring(0, 100) + (body.length > 100 ? "..." : ""),
        message:
          "Email logged (not sent). Set AZURE_EMAIL_CONNECTION_STRING to enable live sending.",
      };
    }

    // ── Send via Azure ECS ────────────────────────────────────────────
    try {
      const emailClient = new EmailClient(connectionString);

      const htmlBody = html || toCleanHtml(body);

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
      };

      const poller = await emailClient.beginSend(message);
      const result = await poller.pollUntilDone();

      if (result.status === "Succeeded") {
        console.log(`[sendEmail] Email sent to ${to} (id: ${result.id})`);
        return {
          status: "sent",
          to,
          subject,
          messageId: result.id,
          bodyPreview: body.substring(0, 100) + (body.length > 100 ? "..." : ""),
        };
      } else {
        console.error(`[sendEmail] Azure ECS error: status=${result.status}`, result.error);
        return {
          status: "failed",
          to,
          subject,
          error: result.error?.message || `Send status: ${result.status}`,
        };
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("[sendEmail] Failed to send email:", errMsg);
      return {
        status: "failed",
        to,
        subject,
        error: errMsg,
      };
    }
  },
});
