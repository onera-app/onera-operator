import { tool } from "ai";
import { z } from "zod";
import { Resend } from "resend";

/**
 * Send Email Tool — uses Resend for production email delivery.
 *
 * Requires RESEND_API_KEY and RESEND_FROM_EMAIL environment variables.
 * Falls back to a logged mock when keys are not configured.
 */
export const sendEmail = tool({
  description:
    "Send an email to a recipient. Use this for outreach, follow-ups, or notifications. " +
    "Requires RESEND_API_KEY to be configured for live sending.",
  parameters: z.object({
    to: z.string().email().describe("Recipient email address"),
    subject: z.string().describe("Email subject line"),
    body: z.string().describe("Email body content (plain text or markdown)"),
    replyTo: z.string().email().optional().describe("Reply-to address"),
    html: z.string().optional().describe("Optional HTML body (overrides plain text body)"),
  }),
  execute: async ({ to, subject, body, replyTo, html }) => {
    const apiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL || "Onera Operator <operator@onera.app>";

    if (!apiKey) {
      // Development / unconfigured: log and return queued status
      console.log(
        `[sendEmail] RESEND_API_KEY not set — would send:\n  To: ${to}\n  Subject: ${subject}\n  Body: ${body.substring(0, 200)}...`
      );
      return {
        status: "queued",
        to,
        subject,
        bodyPreview: body.substring(0, 100) + (body.length > 100 ? "..." : ""),
        message:
          "Email logged (not sent). Set RESEND_API_KEY to enable live sending.",
      };
    }

    try {
      const resend = new Resend(apiKey);

      // Convert plain text to HTML paragraphs if no HTML provided
      const htmlBody =
        html ||
        `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; line-height: 1.6; color: #333;">${body
          .split("\n\n")
          .map((para) => `<p>${para.replace(/\n/g, "<br>")}</p>`)
          .join("")}</div>`;

      const payload: Parameters<Resend["emails"]["send"]>[0] = {
        from: fromEmail,
        to,
        subject,
        html: htmlBody,
        text: body,
      };

      if (replyTo) {
        payload.replyTo = replyTo;
      }

      const result = await resend.emails.send(payload);

      if (result.error) {
        console.error("[sendEmail] Resend error:", result.error);
        return {
          status: "failed",
          to,
          subject,
          error: result.error.message,
        };
      }

      console.log(`[sendEmail] Email sent to ${to} (id: ${result.data?.id})`);
      return {
        status: "sent",
        to,
        subject,
        messageId: result.data?.id,
        bodyPreview: body.substring(0, 100) + (body.length > 100 ? "..." : ""),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[sendEmail] Failed to send email:", message);
      return {
        status: "failed",
        to,
        subject,
        error: message,
      };
    }
  },
});
