import { tool } from "ai";
import { z } from "zod";
import { prisma } from "@onera/database";
import { sendEmailCore } from "./send-email.js";

/**
 * Send Follow-Up Email Tool — sends a threaded follow-up in an existing conversation.
 *
 * Automatically sets In-Reply-To and References headers from the conversation chain.
 * Prefixes subject with "Re:" if not already present.
 * Links to the existing EmailConversation and Contact.
 */
export const sendFollowUp = tool({
  description:
    "Send a follow-up email in an existing conversation thread. Use this when you want to follow up " +
    "with a contact who hasn't replied. This tool automatically threads the email properly with " +
    "In-Reply-To and References headers so it appears in the same thread in the recipient's inbox. " +
    "You need either a conversationId or a previousEmailId to use this tool.",
  inputSchema: z.object({
    conversationId: z.string().describe(
      "The conversation ID to follow up in. Get this from getEmailConversations tool. " +
      "Use empty string if using previousEmailId instead."
    ),
    previousEmailId: z.string().describe(
      "The ID of the previous email in this thread (the EmailLog id). " +
      "Use empty string if using conversationId instead."
    ),
    body: z.string().describe("Follow-up email body content (plain text)."),
    from: z.string().describe(
      "Sender email address. Use the Company Email from startup context (e.g. companyname@onera.app)."
    ),
    replyTo: z.string().describe("Reply-to email address. Use an empty string if not needed."),
    projectId: z.string().describe("The project ID for tracking."),
  }),
  execute: async ({
    conversationId: rawConvId, previousEmailId: rawPrevId,
    body, from: rawFrom, replyTo: rawReplyTo, projectId,
  }) => {
    const conversationId = rawConvId.length > 0 ? rawConvId : undefined;
    const previousEmailId = rawPrevId.length > 0 ? rawPrevId : undefined;
    const from = rawFrom.length > 0 ? rawFrom : undefined;
    const replyTo = rawReplyTo.length > 0 ? rawReplyTo : undefined;

    if (!conversationId && !previousEmailId) {
      return {
        status: "failed",
        error: "Must provide either conversationId or previousEmailId to send a follow-up.",
      };
    }

    try {
      // Resolve the conversation and get the last email in the thread
      let conversation;
      let lastEmail;

      if (conversationId) {
        conversation = await prisma.emailConversation.findUnique({
          where: { id: conversationId },
          include: { contact: true },
        });
        if (!conversation) {
          return { status: "failed", error: `Conversation ${conversationId} not found.` };
        }
        // Get the last outbound email in this conversation
        lastEmail = await prisma.emailLog.findFirst({
          where: { conversationId, direction: "OUTBOUND" },
          orderBy: { sentAt: "desc" },
        });
      } else if (previousEmailId) {
        lastEmail = await prisma.emailLog.findUnique({
          where: { id: previousEmailId },
          include: { conversation: { include: { contact: true } } },
        });
        if (!lastEmail) {
          return { status: "failed", error: `Email ${previousEmailId} not found.` };
        }
        conversation = lastEmail.conversation;
      }

      if (!lastEmail) {
        return { status: "failed", error: "No previous email found in this conversation to follow up on." };
      }

      // Build threading headers
      const inReplyTo = lastEmail.messageId || undefined;
      const references = lastEmail.references
        ? `${lastEmail.references} ${lastEmail.messageId || ""}`
        : lastEmail.messageId || undefined;

      // Build subject — add "Re:" if not already present
      const subject = lastEmail.subject.match(/^re:/i)
        ? lastEmail.subject
        : `Re: ${lastEmail.subject}`;

      // Update conversation status to FOLLOW_UP
      if (conversation) {
        try {
          await prisma.emailConversation.update({
            where: { id: conversation.id },
            data: { status: "FOLLOW_UP" },
          });
        } catch { /* ignore */ }
      }

      return sendEmailCore({
        to: lastEmail.toEmail,
        subject,
        body,
        from,
        replyTo,
        projectId,
        inReplyTo,
        references,
        conversationId: conversation?.id,
        emailType: "FOLLOW_UP",
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("[sendFollowUp] Error:", errMsg);
      return { status: "failed", error: errMsg };
    }
  },
});
