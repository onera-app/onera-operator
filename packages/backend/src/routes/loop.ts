import type { FastifyInstance } from "fastify";
import { getSchedulerQueue, getReportQueue } from "../queue/scheduler.queue.js";
import { prisma } from "@onera/database";

/** Verify the authenticated user owns a project. Returns true if valid, sends 404 and returns false otherwise. */
async function verifyProjectOwnership(
  projectId: string,
  userId: string,
  reply: import("fastify").FastifyReply
): Promise<boolean> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true, paused: true },
  });
  if (!project) {
    reply.code(404).send({ error: "Project not found" });
    return false;
  }
  if (project.paused) {
    reply.code(409).send({ error: "Project is paused. Unpause it before triggering the agent loop." });
    return false;
  }
  return true;
}

export async function loopRoutes(app: FastifyInstance) {
  // Manually trigger one agent loop cycle
  app.post<{ Body: { projectId?: string } }>(
    "/api/loop/trigger",
    async (request, reply) => {
      const { projectId } = request.body || {};

      if (projectId) {
        if (!(await verifyProjectOwnership(projectId, request.authUser!.id, reply))) {
          return;
        }
      }

      const queue = getSchedulerQueue();

      await queue.add("manual-agent-loop", {
        type: "agent-loop",
        projectId,
      });

      return reply.send({
        message: "Agent loop triggered",
        projectId: projectId || "all projects",
      });
    }
  );

  // Manually trigger a daily report
  app.post<{ Body: { projectId?: string } }>(
    "/api/reports/generate",
    async (request, reply) => {
      const { projectId } = request.body || {};

      if (projectId) {
        if (!(await verifyProjectOwnership(projectId, request.authUser!.id, reply))) {
          return;
        }
      }

      const queue = getReportQueue();

      await queue.add("manual-daily-report", {
        type: "daily-report",
        projectId,
      });

      return reply.send({
        message: "Daily report generation triggered",
        projectId: projectId || "all projects",
      });
    }
  );
}
