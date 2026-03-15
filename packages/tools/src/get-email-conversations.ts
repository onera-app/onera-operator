import { tool } from "ai";
import { z } from "zod";
import { prisma } from "@onera/database";

/**
 * Get Email Conversations Tool — retrieves conversation threads for a project.
 *
 * Used by agents to understand the current state of outreach:
 * - Which contacts have replied
 * - Which conversations need follow-up
 * - Full conversation history for context before replying
 */
export const getEmailConversations = tool({
  description:
    "Get email conversations for a project. Returns conversation threads with contact info, " +
    "reply status, and message history. Use this to check which contacts have replied, " +
    "which need follow-ups, and to get conversation context before sending replies or follow-ups. " +
    "Filter by status: ACTIVE (sent, no reply), REPLIED (contact replied), " +
    "FOLLOW_UP (we sent a follow-up), CLOSED (conversation ended).",
  inputSchema: z.object({
    projectId: z.string().describe("The project ID to get conversations for."),
    status: z.string().describe(
      "Filter by conversation status. Options: ACTIVE, REPLIED, FOLLOW_UP, CLOSED, or ALL. " +
      "Use 'REPLIED' to find conversations that need a response. " +
      "Use 'ACTIVE' to find conversations that might need a follow-up. " +
      "Use 'ALL' for everything."
    ),
    limit: z.number().describe("Max conversations to return. Use 20 for a summary, 5 for detailed review."),
    includeMessages: z.boolean().describe(
      "If true, includes the full message history for each conversation. " +
      "Set to true when you need to read replies and craft responses. " +
      "Set to false for a quick overview."
    ),
  }),
  execute: async ({ projectId, status, limit, includeMessages }) => {
    try {
      const where: Record<string, unknown> = { projectId };
      if (status !== "ALL") {
        where.status = status;
      }

      const conversations = await prisma.emailConversation.findMany({
        where,
        include: {
          contact: true,
          ...(includeMessages && {
            emailLogs: {
              orderBy: { sentAt: "asc" as const },
              select: {
                id: true,
                fromEmail: true,
                toEmail: true,
                subject: true,
                body: true,
                direction: true,
                status: true,
                deliveryStatus: true,
                type: true,
                messageId: true,
                sentAt: true,
              },
            },
          }),
        },
        orderBy: { lastActivityAt: "desc" },
        take: limit,
      });

      // Format for agent consumption
      const formatted = conversations.map((conv) => ({
        conversationId: conv.id,
        status: conv.status,
        subject: conv.subject,
        messageCount: conv.messageCount,
        lastActivityAt: conv.lastActivityAt.toISOString(),
        contact: {
          email: conv.contact.email,
          name: conv.contact.name,
          company: conv.contact.company,
          role: conv.contact.role,
          companyUrl: conv.contact.companyUrl,
        },
        ...(includeMessages && "emailLogs" in conv && {
          messages: (conv as typeof conv & { emailLogs: Array<{
            id: string; fromEmail: string; toEmail: string; subject: string;
            body: string; direction: string; status: string; deliveryStatus: string;
            type: string; messageId: string | null; sentAt: Date;
          }> }).emailLogs.map((msg) => ({
            id: msg.id,
            from: msg.fromEmail,
            to: msg.toEmail,
            subject: msg.subject,
            body: msg.body.substring(0, 1000), // Truncate for context window
            direction: msg.direction,
            status: msg.status,
            deliveryStatus: msg.deliveryStatus,
            type: msg.type,
            messageId: msg.messageId,
            sentAt: msg.sentAt.toISOString(),
          })),
        }),
      }));

      // Also compute summary stats
      const stats = {
        total: await prisma.emailConversation.count({ where: { projectId } }),
        active: await prisma.emailConversation.count({ where: { projectId, status: "ACTIVE" } }),
        replied: await prisma.emailConversation.count({ where: { projectId, status: "REPLIED" } }),
        followUp: await prisma.emailConversation.count({ where: { projectId, status: "FOLLOW_UP" } }),
        closed: await prisma.emailConversation.count({ where: { projectId, status: "CLOSED" } }),
      };

      return {
        conversations: formatted,
        stats,
        message: `Found ${formatted.length} conversations (${stats.replied} with replies, ${stats.active} awaiting reply, ${stats.followUp} followed up).`,
      };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("[getEmailConversations] Error:", errMsg);
      return { conversations: [], stats: null, error: errMsg };
    }
  },
});

/**
 * Reply to an inbound email in an existing conversation.
 * Used when a contact has replied and the agent needs to respond.
 */
export const replyToEmail = tool({
  description:
    "Reply to an email in a conversation where the contact has responded. " +
    "Use this after checking getEmailConversations for conversations with status 'REPLIED'. " +
    "This sends a properly-threaded reply that will appear in the same thread in the recipient's inbox.",
  inputSchema: z.object({
    conversationId: z.string().describe("The conversation ID to reply in."),
    body: z.string().describe("Reply email body content (plain text)."),
    from: z.string().describe(
      "Sender email address. Use the Company Email from startup context."
    ),
    replyTo: z.string().describe("Reply-to email address. Use an empty string if not needed."),
    projectId: z.string().describe("The project ID for tracking."),
  }),
  execute: async ({ conversationId, body, from: rawFrom, replyTo: rawReplyTo, projectId }) => {
    const from = rawFrom.length > 0 ? rawFrom : undefined;
    const replyTo = rawReplyTo.length > 0 ? rawReplyTo : undefined;

    try {
      const conversation = await prisma.emailConversation.findUnique({
        where: { id: conversationId },
        include: { contact: true },
      });

      if (!conversation) {
        return { status: "failed", error: `Conversation ${conversationId} not found.` };
      }

      // Get the most recent message (ideally the inbound reply)
      const lastMessage = await prisma.emailLog.findFirst({
        where: { conversationId },
        orderBy: { sentAt: "desc" },
      });

      if (!lastMessage) {
        return { status: "failed", error: "No messages found in this conversation." };
      }

      // Build threading headers
      const inReplyTo = lastMessage.messageId || undefined;
      const references = lastMessage.references
        ? `${lastMessage.references} ${lastMessage.messageId || ""}`
        : lastMessage.messageId || undefined;

      // Build subject
      const subject = lastMessage.subject.match(/^re:/i)
        ? lastMessage.subject
        : `Re: ${lastMessage.subject}`;

      // The "to" should be the contact's email
      const to = conversation.contact.email;

      // Import and use sendEmailCore
      const { sendEmailCore } = await import("./send-email.js");

      const result = await sendEmailCore({
        to,
        subject,
        body,
        from,
        replyTo,
        projectId,
        inReplyTo,
        references,
        conversationId,
        emailType: "REPLY",
      });

      // Update conversation status back to ACTIVE after our reply
      if (result.status === "sent" || result.status === "queued") {
        try {
          await prisma.emailConversation.update({
            where: { id: conversationId },
            data: { status: "ACTIVE" },
          });
        } catch { /* ignore */ }
      }

      return result;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("[replyToEmail] Error:", errMsg);
      return { status: "failed", error: errMsg };
    }
  },
});
