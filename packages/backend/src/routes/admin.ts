import type { FastifyInstance } from "fastify";
import { prisma } from "@onera/database";
import { requireAdmin } from "../middleware/admin.js";

export async function adminRoutes(app: FastifyInstance) {
  // All routes in this plugin require admin
  app.addHook("preHandler", requireAdmin);

  // ─── System Stats Overview ────────────────────────────────────────
  app.get("/api/admin/stats", async (_request, reply) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      totalUsers,
      totalProjects,
      activeProjects,
      totalTasks,
      completedTasks,
      failedTasks,
      tasksToday,
      totalEmails,
      emailsToday,
      totalTweets,
      tweetsToday,
      totalCredits,
      creditsConsumedToday,
      totalConversations,
      repliedConversations,
      totalContacts,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.project.count(),
      prisma.project.count({ where: { paused: false } }),
      prisma.task.count(),
      prisma.task.count({ where: { status: "COMPLETED" } }),
      prisma.task.count({ where: { status: "FAILED" } }),
      prisma.task.count({ where: { createdAt: { gte: today } } }),
      prisma.emailLog.count({ where: { direction: "OUTBOUND" } }),
      prisma.emailLog.count({ where: { direction: "OUTBOUND", sentAt: { gte: today } } }),
      prisma.tweetQueue.count({ where: { status: "POSTED" } }),
      prisma.tweetQueue.count({ where: { postedAt: { gte: today } } }),
      prisma.user.aggregate({ _sum: { credits: true } }),
      prisma.creditTransaction.aggregate({
        _sum: { amount: true },
        where: { type: "TASK_DEDUCTION", createdAt: { gte: today } },
      }),
      prisma.emailConversation.count(),
      prisma.emailConversation.count({ where: { status: "REPLIED" } }),
      prisma.contact.count(),
    ]);

    // Agent statuses
    const agents = await prisma.agentStatus.findMany();

    return reply.send({
      users: { total: totalUsers },
      projects: { total: totalProjects, active: activeProjects, paused: totalProjects - activeProjects },
      tasks: {
        total: totalTasks,
        completed: completedTasks,
        failed: failedTasks,
        today: tasksToday,
        failRate: totalTasks > 0 ? Math.round((failedTasks / totalTasks) * 100) : 0,
      },
      emails: {
        total: totalEmails,
        today: emailsToday,
        conversations: totalConversations,
        replied: repliedConversations,
        replyRate: totalConversations > 0 ? Math.round((repliedConversations / totalConversations) * 100) : 0,
      },
      tweets: { total: totalTweets, today: tweetsToday },
      contacts: { total: totalContacts },
      credits: {
        totalInCirculation: totalCredits._sum.credits || 0,
        consumedToday: Math.abs(creditsConsumedToday._sum.amount || 0),
      },
      agents: agents.map((a) => ({
        name: a.name,
        displayName: a.displayName,
        status: a.status,
        lastRunAt: a.lastRunAt,
        lastError: a.lastError,
        tasksCompleted: a.tasksCompleted,
      })),
    });
  });

  // ─── Users ─────────────────────────────────────────────────────────
  app.get<{
    Querystring: { page?: string; limit?: string; search?: string };
  }>("/api/admin/users", async (request, reply) => {
    const { page: rawPage = "1", limit: rawLimit = "50", search } = request.query;
    const page = Math.max(parseInt(rawPage, 10), 1);
    const limit = Math.min(parseInt(rawLimit, 10), 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { email: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          _count: { select: { projects: true, creditTransactions: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return reply.send({ users, total, page, limit });
  });

  app.get<{ Params: { userId: string } }>(
    "/api/admin/users/:userId",
    async (request, reply) => {
      const user = await prisma.user.findUnique({
        where: { id: request.params.userId },
        include: {
          projects: {
            select: {
              id: true,
              name: true,
              website: true,
              paused: true,
              companyEmail: true,
              createdAt: true,
              _count: { select: { tasks: true, emailLogs: true, tweetQueue: true } },
            },
          },
          creditTransactions: {
            orderBy: { createdAt: "desc" },
            take: 20,
          },
        },
      });

      if (!user) {
        return reply.code(404).send({ error: "User not found" });
      }

      return reply.send(user);
    }
  );

  // Manual credit adjustment
  app.post<{
    Params: { userId: string };
    Body: { amount: number; description: string };
  }>("/api/admin/users/:userId/credits", async (request, reply) => {
    const { amount, description } = request.body;
    if (!amount || !description) {
      return reply.code(400).send({ error: "amount and description required" });
    }

    const user = await prisma.user.findUnique({ where: { id: request.params.userId } });
    if (!user) {
      return reply.code(404).send({ error: "User not found" });
    }

    const newBalance = user.credits + amount;

    const [updatedUser] = await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { credits: newBalance },
      }),
      prisma.creditTransaction.create({
        data: {
          userId: user.id,
          type: "MANUAL",
          amount,
          balance: newBalance,
          description: `[Admin] ${description}`,
        },
      }),
    ]);

    return reply.send({ credits: updatedUser.credits, message: `Adjusted by ${amount}. New balance: ${newBalance}` });
  });

  // ─── Projects ─────────────────────────────────────────────────────
  app.get<{
    Querystring: { page?: string; limit?: string; search?: string; userId?: string };
  }>("/api/admin/projects", async (request, reply) => {
    const { page: rawPage = "1", limit: rawLimit = "50", search, userId } = request.query;
    const page = Math.max(parseInt(rawPage, 10), 1);
    const limit = Math.min(parseInt(rawLimit, 10), 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (userId) where.userId = userId;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { website: { contains: search, mode: "insensitive" } },
      ];
    }

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        include: {
          user: { select: { name: true, email: true } },
          _count: {
            select: { tasks: true, emailLogs: true, tweetQueue: true, contacts: true, emailConversations: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.project.count({ where }),
    ]);

    return reply.send({ projects, total, page, limit });
  });

  // ─── Emails (cross-project) ────────────────────────────────────────
  app.get<{
    Querystring: {
      page?: string; limit?: string; status?: string;
      deliveryStatus?: string; direction?: string; projectId?: string;
    };
  }>("/api/admin/emails", async (request, reply) => {
    const {
      page: rawPage = "1", limit: rawLimit = "50",
      status, deliveryStatus, direction, projectId,
    } = request.query;
    const page = Math.max(parseInt(rawPage, 10), 1);
    const limit = Math.min(parseInt(rawLimit, 10), 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (deliveryStatus) where.deliveryStatus = deliveryStatus;
    if (direction) where.direction = direction;
    if (projectId) where.projectId = projectId;

    const [emails, total] = await Promise.all([
      prisma.emailLog.findMany({
        where,
        select: {
          id: true,
          projectId: true,
          fromEmail: true,
          toEmail: true,
          subject: true,
          direction: true,
          status: true,
          deliveryStatus: true,
          type: true,
          sentAt: true,
          project: { select: { name: true } },
          contact: { select: { name: true, company: true } },
          conversation: { select: { id: true, status: true } },
        },
        orderBy: { sentAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.emailLog.count({ where }),
    ]);

    return reply.send({ emails, total, page, limit });
  });

  // ─── Tasks (cross-project) ─────────────────────────────────────────
  app.get<{
    Querystring: {
      page?: string; limit?: string; status?: string;
      category?: string; agentName?: string; projectId?: string;
    };
  }>("/api/admin/tasks", async (request, reply) => {
    const {
      page: rawPage = "1", limit: rawLimit = "50",
      status, category, agentName, projectId,
    } = request.query;
    const page = Math.max(parseInt(rawPage, 10), 1);
    const limit = Math.min(parseInt(rawLimit, 10), 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (category) where.category = category;
    if (agentName) where.agentName = agentName;
    if (projectId) where.projectId = projectId;

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        include: {
          project: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.task.count({ where }),
    ]);

    return reply.send({ tasks, total, page, limit });
  });

  // Retry / Cancel a task
  app.patch<{
    Params: { taskId: string };
    Body: { status: string };
  }>("/api/admin/tasks/:taskId", async (request, reply) => {
    const { status } = request.body;
    const validStatuses = ["PENDING", "CANCELLED", "FAILED"];
    if (!validStatuses.includes(status)) {
      return reply.code(400).send({ error: `Status must be one of: ${validStatuses.join(", ")}` });
    }

    try {
      const task = await prisma.task.update({
        where: { id: request.params.taskId },
        data: { status: status as "PENDING" | "CANCELLED" | "FAILED" },
      });
      return reply.send(task);
    } catch {
      return reply.code(404).send({ error: "Task not found" });
    }
  });

  // ─── Agents ────────────────────────────────────────────────────────
  app.get("/api/admin/agents", async (_request, reply) => {
    const agents = await prisma.agentStatus.findMany({
      orderBy: { name: "asc" },
    });

    // Also get recent execution logs per agent
    const agentsWithLogs = await Promise.all(
      agents.map(async (agent) => {
        const recentLogs = await prisma.executionLog.findMany({
          where: { agentName: agent.name },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            action: true,
            status: true,
            duration: true,
            createdAt: true,
            task: { select: { title: true, projectId: true } },
          },
        });

        const totalExecutions = await prisma.executionLog.count({
          where: { agentName: agent.name },
        });

        const errorCount = await prisma.executionLog.count({
          where: { agentName: agent.name, status: "error" },
        });

        return {
          ...agent,
          recentLogs,
          totalExecutions,
          errorCount,
          errorRate: totalExecutions > 0 ? Math.round((errorCount / totalExecutions) * 100) : 0,
        };
      })
    );

    return reply.send(agentsWithLogs);
  });

  // ─── Billing ───────────────────────────────────────────────────────
  app.get<{
    Querystring: { page?: string; limit?: string; type?: string };
  }>("/api/admin/billing", async (request, reply) => {
    const { page: rawPage = "1", limit: rawLimit = "50", type } = request.query;
    const page = Math.max(parseInt(rawPage, 10), 1);
    const limit = Math.min(parseInt(rawLimit, 10), 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (type) where.type = type;

    const [transactions, total, totalCredits, subscriptions, revenueTransactions] = await Promise.all([
      prisma.creditTransaction.findMany({
        where,
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.creditTransaction.count({ where }),
      prisma.user.aggregate({ _sum: { credits: true } }),
      prisma.user.count({ where: { subscriptionStatus: "active" } }),
      prisma.creditTransaction.aggregate({
        _sum: { amount: true },
        where: { type: { in: ["PURCHASE", "AUTO_CHARGE", "SUBSCRIPTION_RENEWAL"] } },
      }),
    ]);

    return reply.send({
      transactions,
      total,
      page,
      limit,
      summary: {
        totalCreditsInCirculation: totalCredits._sum.credits || 0,
        activeSubscriptions: subscriptions,
        totalRevenue: Math.abs(revenueTransactions._sum.amount || 0),
      },
    });
  });
}
