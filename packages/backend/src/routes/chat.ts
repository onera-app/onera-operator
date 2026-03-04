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

    if (!messages || !Array.isArray(messages)) {
      return reply.code(400).send({ error: "messages array is required" });
    }

    // Build project context
    let projectContext = "No project context available. Ask the user to set up a project first.";

    let resolvedProjectId = projectId;

    if (resolvedProjectId) {
      try {
        projectContext = await buildProjectContext(resolvedProjectId);
      } catch {
        // Invalid projectId — fall through to first-project lookup
        resolvedProjectId = undefined;
      }
    }

    if (!resolvedProjectId) {
      const firstProject = await prisma.project.findFirst({
        orderBy: { updatedAt: "desc" },
      });
      if (firstProject) {
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
      projectContext
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
