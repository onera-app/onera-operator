import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// Load .env from project root (two levels up from packages/backend/dist/)
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../../.env") });

import { buildServer } from "./server.js";
import { AGENT_DISPLAY_NAMES } from "@onera/agents";
import { upsertAgentStatus } from "./services/execution.service.js";

async function main() {
  const port = parseInt(process.env.BACKEND_PORT || "3001", 10);

  // Build the Fastify server
  const server = await buildServer();

  // Start the HTTP server first — this should never be blocked by Redis
  try {
    await server.listen({ port, host: "0.0.0.0" });
    console.log(`[onera] Backend server running on http://localhost:${port}`);
    console.log(`[onera] Health check: http://localhost:${port}/api/health`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }

  // Initialize agent statuses in the database (non-blocking)
  for (const [name, displayName] of Object.entries(AGENT_DISPLAY_NAMES)) {
    await upsertAgentStatus(name, displayName, { status: "idle" }).catch(
      (err) => {
        console.warn(`[init] Failed to init agent status for ${name}:`, err.message || err);
      }
    );
  }

  // Start workers (non-blocking — if Redis is down, workers will retry/fail gracefully)
  if (process.env.REDIS_URL) {
    try {
      const { startTaskWorker } = await import("./workers/task.worker.js");
      const { startSchedulerWorker } = await import("./workers/scheduler.worker.js");
      const { startReportWorker } = await import("./workers/report.worker.js");
      const { setupScheduledJobs } = await import("./queue/scheduler.queue.js");

      const { startStaleTaskCleanup } = await import("./services/stale-task.service.js");

      startTaskWorker();
      startSchedulerWorker();
      startReportWorker();
      await setupScheduledJobs();

      // Start stale task recovery (runs on startup + every 5 minutes)
      startStaleTaskCleanup();

      console.log("[onera] Workers, scheduled jobs, and stale task cleanup started");
    } catch (err) {
      console.warn(
        "[onera] Could not start workers (Redis may not be available):",
        err instanceof Error ? err.message : err
      );
      console.warn("[onera] Server will run without background job processing.");
    }
  } else {
    console.log("[onera] Redis not configured — running without background workers.");
    console.log("[onera] Set REDIS_URL in .env to enable task execution.");
  }
}

main().catch((err) => {
  console.error("[onera] Fatal error:", err);
  process.exit(1);
});
