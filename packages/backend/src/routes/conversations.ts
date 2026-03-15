import type { FastifyInstance } from "fastify";
import { prisma } from "@onera/database";

export async function conversationRoutes(app: FastifyInstance) {
  // List conversations for a project
  app.get<{
    Params: { id: string };
    Querystring: { status?: string; limit?: string; page?: string };
  }>("/api/projects/:id/conversations", async (request, reply) => {
    const { id: projectId } = request.params;
    const userId = request.authUser!.id;
    const { status, limit: rawLimit = "50", page: rawPage = "1" } = request.query;
    const limit = Math.min(parseInt(rawLimit, 10), 100);
    const page = Math.max(parseInt(rawPage, 10), 1);
    const skip = (page - 1) * limit;

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId },
    });
    if (!project) {
      return reply.code(404).send({ error: "Project not found" });
    }

    const where: Record<string, unknown> = { projectId };
    if (status && status !== "ALL") {
      where.status = status;
    }

    const [conversations, total] = await Promise.all([
      prisma.emailConversation.findMany({
        where,
        include: {
          contact: true,
          emailLogs: {
            orderBy: { sentAt: "desc" },
            take: 1,
            select: {
              id: true,
              fromEmail: true,
              toEmail: true,
              subject: true,
              body: true,
              direction: true,
              status: true,
              deliveryStatus: true,
              sentAt: true,
            },
          },
        },
        orderBy: { lastActivityAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.emailConversation.count({ where }),
    ]);

    return reply.send({ conversations, total, page, limit });
  });

  // Get a single conversation with full message thread
  app.get<{
    Params: { id: string; convId: string };
  }>("/api/projects/:id/conversations/:convId", async (request, reply) => {
    const userId = request.authUser!.id;
    const { id: projectId, convId } = request.params;

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId },
    });
    if (!project) {
      return reply.code(404).send({ error: "Project not found" });
    }

    const conversation = await prisma.emailConversation.findFirst({
      where: { id: convId, projectId },
      include: {
        contact: true,
        emailLogs: {
          orderBy: { sentAt: "asc" },
          select: {
            id: true,
            fromEmail: true,
            toEmail: true,
            subject: true,
            body: true,
            htmlBody: true,
            direction: true,
            status: true,
            deliveryStatus: true,
            type: true,
            messageId: true,
            inReplyTo: true,
            sentAt: true,
          },
        },
      },
    });

    if (!conversation) {
      return reply.code(404).send({ error: "Conversation not found" });
    }

    return reply.send(conversation);
  });

  // Get conversation stats for a project
  app.get<{
    Params: { id: string };
  }>("/api/projects/:id/conversations/stats", async (request, reply) => {
    const userId = request.authUser!.id;
    const { id: projectId } = request.params;

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId },
    });
    if (!project) {
      return reply.code(404).send({ error: "Project not found" });
    }

    const [total, active, replied, followUp, closed, totalEmails, inboundEmails, deliveredEmails, bouncedEmails] = await Promise.all([
      prisma.emailConversation.count({ where: { projectId } }),
      prisma.emailConversation.count({ where: { projectId, status: "ACTIVE" } }),
      prisma.emailConversation.count({ where: { projectId, status: "REPLIED" } }),
      prisma.emailConversation.count({ where: { projectId, status: "FOLLOW_UP" } }),
      prisma.emailConversation.count({ where: { projectId, status: "CLOSED" } }),
      prisma.emailLog.count({ where: { projectId, direction: "OUTBOUND" } }),
      prisma.emailLog.count({ where: { projectId, direction: "INBOUND" } }),
      prisma.emailLog.count({ where: { projectId, deliveryStatus: "DELIVERED" } }),
      prisma.emailLog.count({ where: { projectId, deliveryStatus: "BOUNCED" } }),
    ]);

    const replyRate = totalEmails > 0 ? Math.round((inboundEmails / totalEmails) * 100) : 0;
    const deliveryRate = totalEmails > 0 ? Math.round((deliveredEmails / totalEmails) * 100) : 0;
    const bounceRate = totalEmails > 0 ? Math.round((bouncedEmails / totalEmails) * 100) : 0;

    return reply.send({
      conversations: { total, active, replied, followUp, closed },
      emails: { totalSent: totalEmails, totalReceived: inboundEmails, delivered: deliveredEmails, bounced: bouncedEmails },
      rates: { replyRate, deliveryRate, bounceRate },
    });
  });

  // List contacts for a project
  app.get<{
    Params: { id: string };
    Querystring: { limit?: string; page?: string; search?: string };
  }>("/api/projects/:id/contacts", async (request, reply) => {
    const userId = request.authUser!.id;
    const { id: projectId } = request.params;
    const { limit: rawLimit = "50", page: rawPage = "1", search } = request.query;
    const limit = Math.min(parseInt(rawLimit, 10), 100);
    const page = Math.max(parseInt(rawPage, 10), 1);
    const skip = (page - 1) * limit;

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId },
    });
    if (!project) {
      return reply.code(404).send({ error: "Project not found" });
    }

    const where: Record<string, unknown> = { projectId };
    if (search) {
      where.OR = [
        { email: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
        { company: { contains: search, mode: "insensitive" } },
      ];
    }

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        include: {
          _count: { select: { conversations: true, emailLogs: true } },
          conversations: {
            orderBy: { lastActivityAt: "desc" },
            take: 1,
            select: { id: true, status: true, lastActivityAt: true },
          },
        },
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.contact.count({ where }),
    ]);

    return reply.send({ contacts, total, page, limit });
  });
}
