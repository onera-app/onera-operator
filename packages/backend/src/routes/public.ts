import type { FastifyInstance } from "fastify";
import {
  getPublicLiveData,
  answerPublicQuestion,
  checkAskRateLimit,
} from "../services/public.service.js";

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
