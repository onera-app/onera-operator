import type { FastifyInstance } from "fastify";
import { prisma, TweetQueueStatus } from "@onera/database";
import { requireAdmin } from "../middleware/admin.js";

export async function adminTweetRoutes(app: FastifyInstance) {
  // All routes in this plugin require admin
  app.addHook("preHandler", requireAdmin);

  // List queued tweets with filters
  app.get<{
    Querystring: {
      status?: string;
      projectId?: string;
      page?: string;
      limit?: string;
    };
  }>("/api/admin/tweets", async (request, reply) => {
    const { status, projectId, page = "1", limit = "50" } = request.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where: Record<string, unknown> = {};
    if (status && Object.values(TweetQueueStatus).includes(status as TweetQueueStatus)) {
      where.status = status;
    }
    if (projectId) {
      where.projectId = projectId;
    }

    const [tweets, total] = await Promise.all([
      prisma.tweetQueue.findMany({
        where,
        include: { project: { select: { name: true } } },
        orderBy: { generatedAt: "desc" },
        skip,
        take: parseInt(limit),
      }),
      prisma.tweetQueue.count({ where }),
    ]);

    return reply.send({ tweets, total, page: parseInt(page), limit: parseInt(limit) });
  });

  // Update a queued tweet (edit content, change status)
  app.patch<{
    Params: { id: string };
    Body: { content?: string; status?: string };
  }>("/api/admin/tweets/:id", async (request, reply) => {
    const { content, status } = request.body;
    const data: Record<string, unknown> = {};

    if (content !== undefined) {
      if (content.length > 280) {
        return reply.code(400).send({ error: "Tweet exceeds 280 characters" });
      }
      data.content = content;
    }

    if (status !== undefined) {
      if (!Object.values(TweetQueueStatus).includes(status as TweetQueueStatus)) {
        return reply.code(400).send({ error: "Invalid status" });
      }
      data.status = status;
      if (status === "POSTED") {
        data.postedAt = new Date();
        data.postedBy = request.authUser?.id;
      }
    }

    try {
      const tweet = await prisma.tweetQueue.update({
        where: { id: request.params.id },
        data,
        include: { project: { select: { name: true } } },
      });
      return reply.send(tweet);
    } catch {
      return reply.code(404).send({ error: "Tweet not found" });
    }
  });

  // Regenerate a tweet using the AI
  app.post<{ Params: { id: string } }>(
    "/api/admin/tweets/:id/regenerate",
    async (request, reply) => {
      const existing = await prisma.tweetQueue.findUnique({
        where: { id: request.params.id },
        include: { project: true },
      });

      if (!existing) {
        return reply.code(404).send({ error: "Tweet not found" });
      }

      // Use the generateTweet tool to create new content
      const { generateTweet } = await import("@onera/tools");
      const result = await generateTweet.execute(
        {
          topic: "startup showcase",
          startupContext: [
            `Name: ${existing.project.name}`,
            existing.project.description ? `Description: ${existing.project.description}` : "",
            existing.project.product ? `Product: ${existing.project.product}` : "",
            existing.project.targetUsers ? `Target Users: ${existing.project.targetUsers}` : "",
            existing.project.website ? `Website: ${existing.project.website}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
          tone: existing.tone as "sharp" | "matter-of-fact" | "bold" | "empathetic",
        },
        { toolCallId: "regenerate", messages: [] }
      );

      const updated = await prisma.tweetQueue.update({
        where: { id: request.params.id },
        data: {
          content: result.tweet,
          tone: result.tone,
          status: "PENDING",
          postedAt: null,
          postedBy: null,
        },
        include: { project: { select: { name: true } } },
      });

      return reply.send(updated);
    }
  );
}
