import type { FastifyInstance } from "fastify";
import { streamChatAgent } from "@onera/agents";
import { buildProjectContext } from "../services/project.service.js";
import { prisma } from "@onera/database";

export async function chatRoutes(app: FastifyInstance) {
  app.post<{
    Body: {
      messages: Array<{ role: string; content: string }>;
      projectId?: string;
    };
  }>("/api/chat", async (request, reply) => {
    const { messages, projectId } = request.body;
    const userId = request.authUser!.id;

    if (!messages || !Array.isArray(messages)) {
      return reply.code(400).send({ error: "messages array is required" });
    }

    // Build project context scoped to the authenticated user
    let projectContext = "No project context available. Ask the user to set up a project first.";
    let resolvedProjectId = projectId;

    if (resolvedProjectId) {
      try {
        // Verify the project belongs to this user
        const project = await prisma.project.findFirst({
          where: { id: resolvedProjectId, userId },
        });
        if (!project) {
          return reply.code(403).send({ error: "Access denied: project not found for this user" });
        }
        projectContext = await buildProjectContext(resolvedProjectId);
      } catch {
        resolvedProjectId = undefined;
      }
    }

    // Fall back to the user's most recent project
    if (!resolvedProjectId) {
      const firstProject = await prisma.project.findFirst({
        where: { userId },
        orderBy: { updatedAt: "desc" },
      });
      if (firstProject) {
        resolvedProjectId = firstProject.id;
        projectContext = await buildProjectContext(firstProject.id);
      }
    }

    // Stream the chat response
    const result = streamChatAgent(
      messages.map((m) => ({
        id: crypto.randomUUID(),
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      })),
      projectContext,
      {
        projectId: resolvedProjectId,
        userId,
        apiBaseUrl: process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001",
      }
    );

    // Set headers for SSE streaming
    reply.raw.writeHead(200, {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    // Stream text chunks to the response
    for await (const chunk of result.textStream) {
      reply.raw.write(chunk);
    }

    reply.raw.end();
  });
}
