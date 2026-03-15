import { prisma } from "@onera/database";
import type { Contact, EmailConversation, EmailLog } from "@onera/database";
import { publishAgentEvent } from "./activity.service.js";

// ---------------------------------------------------------------------------
// Azure Event Grid event types for Email Communication Service
// ---------------------------------------------------------------------------

interface EventGridEvent {
  id: string;
  topic: string;
  subject: string;
  data: Record<string, unknown>;
  eventType: string;
  eventTime: string;
  metadataVersion: string;
  dataVersion: string;
}

interface DeliveryReportData {
  messageId: string;
  status: string;
  deliveryStatusDetails?: {
    statusMessage?: string;
  };
}

interface EmailReceivedData {
  messageId: string;
  from: string;
  to: string;
  subject: string;
  bodyPlainText?: string;
  bodyHtml?: string;
  receivedAt: string;
  inReplyTo?: string;
  references?: string;
}

// ---------------------------------------------------------------------------
// Delivery Status Update Handler
// ---------------------------------------------------------------------------

export async function handleDeliveryReport(data: DeliveryReportData): Promise<void> {
  const { messageId, status } = data;

  if (!messageId) {
    console.warn("[inbound-email] Delivery report missing messageId");
    return;
  }

  const statusMap: Record<string, "DELIVERED" | "BOUNCED" | "FAILED"> = {
    Delivered: "DELIVERED",
    Expanded: "DELIVERED",
    Failed: "FAILED",
    Bounced: "BOUNCED",
    FilteredSpam: "FAILED",
    Quarantined: "FAILED",
    Suppressed: "FAILED",
  };

  const deliveryStatus = statusMap[status] || "FAILED";

  try {
    const emailLog = await prisma.emailLog.findFirst({
      where: { azureMessageId: messageId },
    });

    if (!emailLog) {
      console.warn(`[inbound-email] No email found for Azure messageId: ${messageId}`);
      return;
    }

    await prisma.emailLog.update({
      where: { id: emailLog.id },
      data: { deliveryStatus },
    });

    console.log(`[inbound-email] Updated delivery status for ${emailLog.toEmail}: ${deliveryStatus}`);

    if (deliveryStatus === "BOUNCED" || deliveryStatus === "FAILED") {
      try {
        await publishAgentEvent({
          projectId: emailLog.projectId,
          agentName: "outreach",
          taskId: "system",
          taskTitle: "Delivery Status Update",
          type: "info",
          message: `Email to ${emailLog.toEmail} ${deliveryStatus.toLowerCase()}`,
          data: { emailId: emailLog.id, deliveryStatus },
        });
      } catch { /* non-critical */ }
    }
  } catch (err) {
    console.error(
      "[inbound-email] Failed to update delivery status:",
      err instanceof Error ? err.message : err
    );
  }
}

// ---------------------------------------------------------------------------
// Inbound Email Handler (Reply Detection)
// ---------------------------------------------------------------------------

export async function handleInboundEmail(data: EmailReceivedData): Promise<void> {
  const { from, to, subject, bodyPlainText, bodyHtml, inReplyTo, references } = data;

  if (!from || !to) {
    console.warn("[inbound-email] Inbound email missing from/to");
    return;
  }

  console.log(`[inbound-email] Processing inbound email from ${from} to ${to} — "${subject}"`);

  try {
    const project = await prisma.project.findFirst({
      where: { companyEmail: to },
    });

    if (!project) {
      console.warn(`[inbound-email] No project found for email address: ${to}`);
      return;
    }

    let parentEmail: (EmailLog & { conversation: EmailConversation | null; contact: Contact | null }) | null = null;
    let conversation: EmailConversation | null = null;
    let contact: Contact | null = null;

    // Strategy 1: Match by In-Reply-To header
    if (inReplyTo) {
      parentEmail = await prisma.emailLog.findFirst({
        where: { messageId: inReplyTo, projectId: project.id },
        include: { conversation: true, contact: true },
      });
    }

    // Strategy 2: Match by References header
    if (!parentEmail && references) {
      const refIds = references.split(/\s+/).filter(Boolean);
      for (const refId of refIds.reverse()) {
        parentEmail = await prisma.emailLog.findFirst({
          where: { messageId: refId, projectId: project.id },
          include: { conversation: true, contact: true },
        });
        if (parentEmail) break;
      }
    }

    // Strategy 3: Match by subject line + sender email
    if (!parentEmail) {
      const normalizedSubject = subject
        .replace(/^(re|fwd|fw):\s*/gi, "")
        .trim();

      parentEmail = await prisma.emailLog.findFirst({
        where: {
          projectId: project.id,
          toEmail: from,
          subject: { contains: normalizedSubject, mode: "insensitive" },
          direction: "OUTBOUND",
        },
        include: { conversation: true, contact: true },
        orderBy: { sentAt: "desc" },
      });
    }

    // Get or create contact
    if (parentEmail?.contact) {
      contact = parentEmail.contact;
    } else {
      contact = await prisma.contact.findUnique({
        where: { projectId_email: { projectId: project.id, email: from } },
      });
      if (!contact) {
        contact = await prisma.contact.create({
          data: {
            projectId: project.id,
            email: from,
            source: "INBOUND",
          },
        });
      }
    }

    // Get or create conversation
    if (parentEmail?.conversation) {
      conversation = parentEmail.conversation;
    } else if (contact) {
      const normalizedSubject = subject.replace(/^(re|fwd|fw):\s*/gi, "").trim();
      conversation = await prisma.emailConversation.findFirst({
        where: {
          projectId: project.id,
          contactId: contact.id,
          subject: { contains: normalizedSubject, mode: "insensitive" },
        },
      });
      if (!conversation) {
        conversation = await prisma.emailConversation.create({
          data: {
            projectId: project.id,
            contactId: contact.id,
            subject: normalizedSubject || subject,
            status: "REPLIED",
            messageCount: 1,
          },
        });
      }
    }

    // Create inbound EmailLog record
    const inboundEmail = await prisma.emailLog.create({
      data: {
        projectId: project.id,
        conversationId: conversation?.id,
        contactId: contact?.id,
        fromEmail: from,
        toEmail: to,
        subject,
        body: bodyPlainText || "",
        htmlBody: bodyHtml,
        direction: "INBOUND",
        status: "SENT",
        deliveryStatus: "DELIVERED",
        type: "REPLY",
        inReplyTo: inReplyTo || parentEmail?.messageId || undefined,
        references: references || undefined,
      },
    });

    // Update conversation status to REPLIED
    if (conversation) {
      await prisma.emailConversation.update({
        where: { id: conversation.id },
        data: {
          status: "REPLIED",
          lastActivityAt: new Date(),
          messageCount: { increment: 1 },
        },
      });
    }

    // Publish activity event
    try {
      await publishAgentEvent({
        projectId: project.id,
        agentName: "outreach",
        taskId: "system",
        taskTitle: "Inbound Reply",
        type: "info",
        message: `Reply received from ${contact?.name || from}: "${subject}"`,
        data: {
          emailId: inboundEmail.id,
          conversationId: conversation?.id,
          contactEmail: from,
        },
      });
    } catch { /* non-critical */ }

    console.log(
      `[inbound-email] Processed inbound reply from ${from} — ` +
      `conversation: ${conversation?.id || "new"}, contact: ${contact?.id || "new"}`
    );
  } catch (err) {
    console.error(
      "[inbound-email] Failed to process inbound email:",
      err instanceof Error ? err.message : err
    );
  }
}

// ---------------------------------------------------------------------------
// Event Grid Webhook Processor
// ---------------------------------------------------------------------------

export async function processEventGridEvents(events: EventGridEvent[]): Promise<{
  validationResponse?: string;
  processed: number;
  errors: number;
}> {
  let processed = 0;
  let errors = 0;

  for (const event of events) {
    try {
      // Handle subscription validation handshake
      // Azure Event Grid expects: { "validationResponse": "<validationCode>" }
      if (event.eventType === "Microsoft.EventGrid.SubscriptionValidationEvent") {
        const validationCode = (event.data as { validationCode: string }).validationCode;
        console.log("[inbound-email] Event Grid validation request:", validationCode);
        return { validationResponse: validationCode, processed: 0, errors: 0 };
      }

      // Handle delivery reports
      if (event.eventType === "Microsoft.Communication.EmailDeliveryReportReceived") {
        await handleDeliveryReport(event.data as unknown as DeliveryReportData);
        processed++;
      }

      // Handle inbound emails
      if (event.eventType === "Microsoft.Communication.EmailReceived") {
        await handleInboundEmail(event.data as unknown as EmailReceivedData);
        processed++;
      }

      // Handle engagement events (open/click tracking)
      if (event.eventType === "Microsoft.Communication.EmailEngagementTrackingReportReceived") {
        const engagementData = event.data as { messageId?: string; engagementType?: string };

        const statusMap: Record<string, "OPENED" | "CLICKED"> = {
          View: "OPENED",
          Click: "CLICKED",
        };

        const newStatus = engagementData.engagementType ? statusMap[engagementData.engagementType] : undefined;
        if (newStatus && engagementData.messageId) {
          const emailLog = await prisma.emailLog.findFirst({
            where: { azureMessageId: engagementData.messageId },
          });
          if (emailLog) {
            const statusOrder = ["PENDING", "DELIVERED", "OPENED", "CLICKED"];
            const currentIdx = statusOrder.indexOf(emailLog.deliveryStatus);
            const newIdx = statusOrder.indexOf(newStatus);
            if (newIdx > currentIdx) {
              await prisma.emailLog.update({
                where: { id: emailLog.id },
                data: { deliveryStatus: newStatus },
              });
            }
          }
          processed++;
        }
      }
    } catch (err) {
      console.error(
        `[inbound-email] Error processing event ${event.eventType}:`,
        err instanceof Error ? err.message : err
      );
      errors++;
    }
  }

  return { processed, errors };
}
