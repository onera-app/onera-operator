import type { FastifyInstance } from "fastify";
import { streamChatAgent } from "@onera/agents";
import { buildProjectContext } from "../services/project.service.js";
import { prisma } from "@onera/database";
import { INTERNAL_SECRET } from "../middleware/auth.js";
import type { ModelMessage } from "ai";

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
      } catch (err: any) {
        console.warn("[chat] Failed to load project context:", err.message || err);
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
    // Use internal secret for tool→API calls (JWT expires mid-stream)
    // Filter to only user/assistant roles — "system" is not a valid ModelMessage role in AI SDK v6
    const modelMessages: ModelMessage[] = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));
    const result = streamChatAgent(
      modelMessages,
      projectContext,
      {
        projectId: resolvedProjectId,
        userId,
        apiBaseUrl: process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001",
        internalSecret: INTERNAL_SECRET,
      }
    );

    // Set headers for SSE streaming
    reply.raw.writeHead(200, {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    // Stream full events so the frontend can show thinking/tool-call status.
    // Status lines are prefixed with %%STATUS%% and are stripped from the
    // final message content by the frontend.
    try {
      for await (const part of result.fullStream) {
        switch (part.type) {
          case "tool-call":
            reply.raw.write(
              `%%STATUS%%{"type":"tool-call","tool":"${part.toolName}"}%%END%%\n`
            );
            break;
          case "tool-result":
            reply.raw.write(
              `%%STATUS%%{"type":"tool-result","tool":"${part.toolName}"}%%END%%\n`
            );
            break;
          case "text-delta":
            reply.raw.write(part.text);
            break;
          case "error":
            console.error("[chat] Stream error part:", part.error);
            reply.raw.write(
              `I encountered an error. Please try again.`
            );
            break;
          // step-start, step-finish, finish, etc — skip silently
        }
      }
    } catch (streamErr) {
      const errMsg = streamErr instanceof Error ? streamErr.message : String(streamErr);
      console.error("[chat] Stream error:", errMsg);
      reply.raw.write(
        `I encountered an error processing your request. Please try again. (${errMsg.slice(0, 200)})`
      );
    }

    reply.raw.end();
  });
}
