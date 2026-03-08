import type { FastifyInstance } from "fastify";
import { streamChatAgent } from "@onera/agents";
import { buildProjectContext } from "../services/project.service.js";
import { prisma } from "@onera/database";
import { INTERNAL_SECRET } from "../middleware/auth.js";
import { convertToModelMessages, type ModelMessage } from "ai";

export async function chatRoutes(app: FastifyInstance) {
  app.post<{
    Body: {
      // AI SDK v6 useChat sends UIMessage[] (with .parts), not { role, content }
      messages: Array<Record<string, unknown>>;
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

    // AI SDK v6: useChat with TextStreamChatTransport sends UIMessage[] (with .parts arrays).
    // Convert to ModelMessage[] that streamText() expects.
    // Also handles legacy { role, content } format for backwards compatibility.
    let modelMessages: ModelMessage[];
    try {
      // Check if messages are UIMessage format (have .parts) or legacy format (have .content string)
      const isUIFormat = messages.some((m) => Array.isArray(m.parts));
      if (isUIFormat) {
        modelMessages = await convertToModelMessages(
          messages.filter((m) => m.role === "user" || m.role === "assistant") as any
        );
      } else {
        // Legacy format: { role, content: string }
        modelMessages = messages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content as string,
          }));
      }
    } catch (err: any) {
      console.error("[chat] Failed to convert messages:", err.message || err);
      return reply.code(400).send({ error: "Invalid message format" });
    }

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
          case "tool-result": {
            // For webSearch, forward the result URLs so the frontend can make [1][2] references clickable
            let sources: Array<{ title: string; url: string }> | undefined;
            const toolOutput = (part as any).output ?? (part as any).result;
            if (part.toolName === "webSearch" && toolOutput && typeof toolOutput === "object") {
              const res = toolOutput as { results?: Array<{ title?: string; url?: string }> };
              if (Array.isArray(res.results)) {
                sources = res.results
                  .filter((r) => r.url)
                  .map((r) => ({ title: r.title || "", url: r.url! }));
              }
            }
            const statusPayload: Record<string, unknown> = { type: "tool-result", tool: part.toolName };
            if (sources && sources.length > 0) {
              statusPayload.sources = sources;
            }
            reply.raw.write(
              `%%STATUS%%${JSON.stringify(statusPayload)}%%END%%\n`
            );
            break;
          }
          case "text-delta":
            reply.raw.write(part.text);
            break;
          case "error": {
            const errDetail = part.error instanceof Error ? part.error.message : String(part.error);
            console.error("[chat] Stream error part:", errDetail, part.error);
            reply.raw.write(
              `\n\nSorry, something went wrong while processing your request. (${errDetail.slice(0, 150)})`
            );
            break;
          }
          // step-start, step-finish, finish, etc — skip silently
        }
      }
    } catch (streamErr) {
      const errMsg = streamErr instanceof Error ? streamErr.message : String(streamErr);
      console.error("[chat] Stream error:", errMsg, streamErr);
      reply.raw.write(
        `\n\nSorry, something went wrong processing your request. (${errMsg.slice(0, 200)})`
      );
    }

    reply.raw.end();
  });
}
