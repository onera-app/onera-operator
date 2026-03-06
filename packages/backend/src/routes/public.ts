import type { FastifyInstance } from "fastify";
import {
  getPublicLiveData,
  answerPublicQuestion,
  checkAskRateLimit,
} from "../services/public.service.js";
import { createActivitySubscriber } from "../services/activity.service.js";

export async function publicRoutes(app: FastifyInstance) {
  // CORS preflight for POST /api/public/ask
  app.options("/api/public/ask", async (_request, reply) => {
    reply
      .header("Access-Control-Allow-Origin", "*")
      .header("Access-Control-Allow-Methods", "POST, OPTIONS")
      .header("Access-Control-Allow-Headers", "Content-Type")
      .status(204)
      .send();
  });

  app.get("/api/public/live", async (_request, reply) => {
    const data = await getPublicLiveData();
    reply.header("Access-Control-Allow-Origin", "*");
    return reply.send(data);
  });

  // ── Public SSE stream — real-time agent activity (no auth) ──────
  app.get("/api/public/stream", async (request, reply) => {
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    reply.raw.write(": connected\n\n");

    const { unsubscribe } = createActivitySubscriber((event) => {
      // Redact sensitive data for public consumption
      const publicEvent = {
        type: event.type,
        agentName: event.agentName,
        taskTitle: event.taskTitle,
        message: event.message,
        timestamp: event.timestamp,
      };
      reply.raw.write(`data: ${JSON.stringify(publicEvent)}\n\n`);
    });

    const keepalive = setInterval(() => {
      reply.raw.write(": keepalive\n\n");
    }, 15000);

    request.raw.on("close", () => {
      clearInterval(keepalive);
      unsubscribe();
    });
  });

  app.post("/api/public/ask", async (request, reply) => {
    reply.header("Access-Control-Allow-Origin", "*");

    // Rate limit: 5 requests/min per IP
    const ip = request.ip || "unknown";
    if (!checkAskRateLimit(ip)) {
      return reply.status(429).send({
        error: "Too many questions — please wait a moment before asking again.",
      });
    }

    const body = request.body as { question?: string } | undefined;
    const question = body?.question?.trim();
    if (!question || question.length < 2 || question.length > 500) {
      return reply.status(400).send({
        error: "Please provide a question (2–500 characters).",
      });
    }

    try {
      const answer = await answerPublicQuestion(question);
      return reply.send({ answer });
    } catch (err) {
      request.log.error(err, "public ask error");
      return reply.status(500).send({
        error: "Sorry, I couldn't process that right now. Try again in a moment.",
      });
    }
  });
}
