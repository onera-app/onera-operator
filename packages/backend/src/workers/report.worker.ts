import { Worker } from "bullmq";
import { getRedisConnection } from "../queue/connection.js";
import type { SchedulerJob } from "../queue/scheduler.queue.js";
import { prisma } from "@onera/database";
import { runReportAgent } from "@onera/agents";
import { AGENT_DISPLAY_NAMES } from "@onera/agents";
import { buildProjectContext } from "../services/project.service.js";
import {
  getRecentCompletedTasks,
  getTaskMetrics,
  listTasks,
} from "../services/task.service.js";
import { createDailyReport, sendDailyDigestEmail } from "../services/report.service.js";
import { upsertAgentStatus } from "../services/execution.service.js";

/**
 * Report Generation Worker
 *
 * Generates daily reports for all projects.
 */
export function startReportWorker(): Worker<SchedulerJob> {
  // Use dedicated report-scheduler queue to avoid competing with scheduler worker
  const worker = new Worker<SchedulerJob>(
    "report-scheduler",
    async (job) => {
      if (job.data.type !== "daily-report") return;

      console.log("[report-worker] Generating daily reports...");

      await upsertAgentStatus(
        "report",
        AGENT_DISPLAY_NAMES.report || "Report Generator",
        { status: "running", lastRunAt: new Date() }
      );

      const projects = job.data.projectId
        ? await prisma.project.findMany({
            where: { id: job.data.projectId },
          })
        : await prisma.project.findMany();

      for (const project of projects) {
        try {
          const projectContext = await buildProjectContext(project.id);
          const completedTasks = await getRecentCompletedTasks(
            project.id,
            20
          );
          const metrics = await getTaskMetrics(project.id);
          const allTasks = await listTasks({ projectId: project.id });

          const failedTasks = allTasks
            .filter((t) => t.status === "FAILED")
            .slice(0, 10);
          const pendingTasks = allTasks
            .filter((t) => t.status === "PENDING")
            .slice(0, 10);

          const today = new Date().toISOString().split("T")[0];

          const report = await runReportAgent({
            projectContext,
            completedTasks:
              completedTasks.length > 0
                ? completedTasks
                    .map(
                      (t) =>
                        `- ${t.title} (${t.category}): ${t.result ? "completed with results" : "completed"}`
                    )
                    .join("\n")
                : "No tasks completed today.",
            failedTasks:
              failedTasks.length > 0
                ? failedTasks
                    .map((t) => `- ${t.title}: ${t.result || "failed"}`)
                    .join("\n")
                : "No failures.",
            pendingTasks:
              pendingTasks.length > 0
                ? pendingTasks
                    .map(
                      (t) =>
                        `- ${t.title} (${t.priority}, ${t.category})`
                    )
                    .join("\n")
                : "No pending tasks.",
            metrics:
              `Completed: ${metrics.completed}\n` +
              `Pending: ${metrics.pending}\n` +
              `In Progress: ${metrics.inProgress}\n` +
              `Failed: ${metrics.failed}`,
            date: today!,
          });

          await createDailyReport({
            projectId: project.id,
            content: report.content,
            tasksCompleted: JSON.stringify(
              completedTasks.map((t) => ({
                title: t.title,
                category: t.category,
              }))
            ),
            tasksPlanned: JSON.stringify(
              pendingTasks.map((t) => ({
                title: t.title,
                category: t.category,
                priority: t.priority,
              }))
            ),
            metrics: JSON.stringify({
              ...metrics,
              highlights: report.highlights,
              blockers: report.blockers,
              nextSteps: report.nextSteps,
            }),
          });

          // Send daily digest email to the project owner (Polsia-style morning email)
          await sendDailyDigestEmail({
            projectId: project.id,
            projectName: project.name,
            reportContent: report.content,
            highlights: report.highlights || [],
            nextSteps: report.nextSteps || [],
            completedCount: metrics.completed,
            pendingCount: metrics.pending,
            date: today!,
          });

          console.log(
            `[report-worker] Generated report for ${project.name}`
          );
        } catch (error) {
          console.error(
            `[report-worker] Failed to generate report for ${project.name}:`,
            error instanceof Error ? error.message : error
          );
        }
      }

      await upsertAgentStatus(
        "report",
        AGENT_DISPLAY_NAMES.report || "Report Generator",
        { status: "idle", lastError: null }
      );

      console.log("[report-worker] Daily report generation complete");
    },
    {
      connection: getRedisConnection(),
      concurrency: 1,
      // Only process daily-report jobs in this worker
    }
  );

  worker.on("error", (err) => {
    console.error("[report-worker] Worker error:", err.message);
  });

  console.log("[report-worker] Report worker started");
  return worker;
}
