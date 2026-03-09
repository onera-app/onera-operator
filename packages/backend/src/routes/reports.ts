import type { FastifyInstance } from "fastify";
import { getLatestReport, listReports } from "../services/report.service.js";
import { prisma } from "@onera/database";

export async function reportRoutes(app: FastifyInstance) {
  // Get the latest report for a project
  app.get<{ Querystring: { projectId: string } }>(
    "/api/reports/latest",
    async (request, reply) => {
      const { projectId } = request.query;
      if (!projectId) {
        return reply.code(400).send({ error: "projectId is required" });
      }
      const userId = request.authUser!.id;
      const project = await prisma.project.findFirst({
        where: { id: projectId, userId },
        select: { id: true },
      });
      if (!project) {
        return reply.code(404).send({ error: "Project not found" });
      }
      const report = await getLatestReport(projectId);
      if (!report) {
        return reply.code(404).send({ error: "No reports found" });
      }
      return reply.send(report);
    }
  );

  // List reports for a project
  app.get<{ Querystring: { projectId: string; limit?: string } }>(
    "/api/reports",
    async (request, reply) => {
      const { projectId, limit } = request.query;
      if (!projectId) {
        return reply.code(400).send({ error: "projectId is required" });
      }
      const userId = request.authUser!.id;
      const project = await prisma.project.findFirst({
        where: { id: projectId, userId },
        select: { id: true },
      });
      if (!project) {
        return reply.code(404).send({ error: "Project not found" });
      }
      const parsedLimit = limit ? parseInt(limit, 10) : 30;
      if (Number.isNaN(parsedLimit)) {
        return reply.code(400).send({ error: "limit must be a number" });
      }
      const reports = await listReports(projectId, parsedLimit);
      return reply.send(reports);
    }
  );
}
