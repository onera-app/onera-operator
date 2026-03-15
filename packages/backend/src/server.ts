import Fastify from "fastify";
import cors from "@fastify/cors";
import { requireAuth } from "./middleware/auth.js";

import { healthRoutes } from "./routes/health.js";
import { projectRoutes } from "./routes/projects.js";
import { taskRoutes } from "./routes/tasks.js";
import { agentRoutes } from "./routes/agents.js";
import { reportRoutes } from "./routes/reports.js";
import { chatRoutes } from "./routes/chat.js";
import { loopRoutes } from "./routes/loop.js";
import { userRoutes } from "./routes/users.js";
import { publicRoutes } from "./routes/public.js";
import { billingRoutes } from "./routes/billing.js";
import { adminTweetRoutes } from "./routes/admin-tweets.js";
import { adminRoutes } from "./routes/admin.js";
import { conversationRoutes } from "./routes/conversations.js";
import { emailWebhookRoutes } from "./routes/webhooks-email.js";

// Routes that do NOT require authentication
const PUBLIC_PATHS = new Set([
  "/api/health",
  "/api/public/live",
  "/api/public/ask",
  "/api/billing/webhooks",
  "/api/webhooks/email",
  "/api/webhooks/email/inbound",
]);

function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.has(path) || path.startsWith("/api/public/");
}

export async function buildServer() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || "info",
    },
  });

  // CORS for frontend
  await app.register(cors, {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  // Auth middleware — runs on every request, skips public paths
  app.addHook("onRequest", async (request, reply) => {
    if (isPublicPath(request.url.split("?")[0])) {
      return; // Skip auth for public routes
    }
    await requireAuth(request, reply);
  });

  // Register routes
  await app.register(healthRoutes);
  await app.register(projectRoutes);
  await app.register(taskRoutes);
  await app.register(agentRoutes);
  await app.register(reportRoutes);
  await app.register(chatRoutes);
  await app.register(loopRoutes);
  await app.register(userRoutes);
  await app.register(publicRoutes);
  await app.register(billingRoutes);
  await app.register(adminTweetRoutes);
  await app.register(adminRoutes);
  await app.register(conversationRoutes);
  await app.register(emailWebhookRoutes);

  return app;
}
