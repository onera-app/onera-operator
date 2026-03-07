import type { FastifyInstance } from "fastify";
import {
  listTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  updateTaskStatus,
  getTaskMetrics,
} from "../services/task.service.js";
import { getExecutionLogs } from "../services/execution.service.js";
import { enqueueTaskExecution } from "../queue/task.queue.js";
import {
  TaskStatus,
  type TaskCategory,
  type TaskPriority,
  prisma,
} from "@onera/database";
import { ACTION_CREDITS } from "../services/billing.service.js";
import { getProjectOwner } from "../services/project.service.js";

export async function taskRoutes(app: FastifyInstance) {
  // List tasks with optional filters
  app.get<{
    Querystring: {
      projectId?: string;
      status?: string;
      category?: string;
      priority?: string;
      automatable?: string;
      agentName?: string;
    };
  }>("/api/tasks", async (request, reply) => {
    const { projectId, status, category, priority, automatable, agentName } =
      request.query;

    const tasks = await listTasks({
      projectId,
      status,
      category,
      priority,
      automatable: automatable ? automatable === "true" : undefined,
      agentName,
    });

    return reply.send(tasks);
  });

  // Get task metrics for a project — must be before /api/tasks/:id to avoid route shadowing
  app.get<{ Querystring: { projectId: string } }>(
    "/api/tasks/metrics",
    async (request, reply) => {
      const { projectId } = request.query;
      if (!projectId) {
        return reply.code(400).send({ error: "projectId is required" });
      }
      const metrics = await getTaskMetrics(projectId);
      return reply.send(metrics);
    }
  );

  // Get a single task with execution logs
  app.get<{ Params: { id: string } }>(
    "/api/tasks/:id",
    async (request, reply) => {
      const task = await getTask(request.params.id);
      if (!task) {
        return reply.code(404).send({ error: "Task not found" });
      }
      return reply.send(task);
    }
  );

  // Create a task
  app.post<{
    Body: {
      projectId: string;
      title: string;
      description: string;
      category: TaskCategory;
      priority: TaskPriority;
      automatable?: boolean;
      agentName?: string;
      scheduledFor?: string;
    };
  }>("/api/tasks", async (request, reply) => {
    const { projectId, title, description, category, priority, automatable, agentName, scheduledFor } =
      request.body;

    if (!projectId || !title || !description || !category || !priority) {
      return reply
        .code(400)
        .send({ error: "projectId, title, description, category, and priority are required" });
    }

    const task = await createTask({
      projectId,
      title,
      description,
      category,
      priority,
      automatable,
      agentName,
      scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
    });

    return reply.code(201).send(task);
  });

  // Update task status
  app.patch<{
    Params: { id: string };
    Body: { status: string; result?: string };
  }>("/api/tasks/:id", async (request, reply) => {
    const { status, result } = request.body;

    if (!status) {
      return reply.code(400).send({ error: "status is required" });
    }

    try {
      const task = await updateTaskStatus(request.params.id, status, result);
      return reply.send(task);
    } catch (err: any) {
      console.error(`[tasks] Failed to update task status ${request.params.id}:`, err.message || err);
      return reply.code(404).send({ error: "Task not found" });
    }
  });

  // Update task fields
  app.put<{
    Params: { id: string };
    Body: {
      title?: string;
      description?: string;
      category?: TaskCategory;
      priority?: TaskPriority;
      status?: string;
      automatable?: boolean;
      agentName?: string | null;
    };
  }>("/api/tasks/:id", async (request, reply) => {
    const { title, description, category, priority, status, automatable, agentName } =
      request.body;

    if (
      title === undefined &&
      description === undefined &&
      category === undefined &&
      priority === undefined &&
      status === undefined &&
      automatable === undefined &&
      agentName === undefined
    ) {
      return reply.code(400).send({ error: "No fields provided to update" });
    }

    if (status && !Object.values(TaskStatus).includes(status as TaskStatus)) {
      return reply.code(400).send({ error: "Invalid status value" });
    }

    try {
      const task = await updateTask(request.params.id, {
        title,
        description,
        category,
        priority,
        status: status as TaskStatus | undefined,
        automatable,
        agentName,
      });
      return reply.send(task);
    } catch (err: any) {
      console.error(`[tasks] Failed to update task ${request.params.id}:`, err.message || err);
      return reply.code(404).send({ error: "Task not found" });
    }
  });

  // Delete a task
  app.delete<{ Params: { id: string } }>("/api/tasks/:id", async (request, reply) => {
    try {
      await deleteTask(request.params.id);
      return reply.code(204).send();
    } catch (err: any) {
      console.error(`[tasks] Failed to delete task ${request.params.id}:`, err.message || err);
      return reply.code(404).send({ error: "Task not found" });
    }
  });

  // Get execution logs for a task
  app.get<{ Params: { id: string } }>(
    "/api/tasks/:id/logs",
    async (request, reply) => {
      const logs = await getExecutionLogs(request.params.id);
      return reply.send(logs);
    }
  );

  // Force-retry a stuck IN_PROGRESS task — resets to PENDING and re-enqueues
  app.post<{ Params: { id: string } }>(
    "/api/tasks/:id/retry",
    async (request, reply) => {
      const task = await getTask(request.params.id);
      if (!task) {
        return reply.code(404).send({ error: "Task not found" });
      }

      if (task.status !== "IN_PROGRESS" && task.status !== "FAILED") {
        return reply.code(400).send({
          error: `Can only retry tasks that are IN_PROGRESS or FAILED. Current status: ${task.status}`,
        });
      }

      if (!task.agentName) {
        return reply
          .code(400)
          .send({ error: "Task has no assigned agent — cannot retry" });
      }

      // Reset to PENDING
      await updateTaskStatus(task.id, "PENDING", JSON.stringify({
        error: `Manually retried by user (was ${task.status})`,
      }));

      // Re-enqueue
      await enqueueTaskExecution({
        taskId: task.id,
        projectId: task.projectId,
        agentName: task.agentName,
        taskTitle: task.title,
        taskDescription: task.description,
      });

      return reply.send({
        message: `Task "${task.title}" reset and re-queued for execution`,
        taskId: task.id,
        agentName: task.agentName,
      });
    }
  );

  // Execute a specific task immediately ("Do it now")
  app.post<{ Params: { id: string } }>(
    "/api/tasks/:id/execute",
    async (request, reply) => {
      const task = await getTask(request.params.id);
      if (!task) {
        return reply.code(404).send({ error: "Task not found" });
      }

      if (task.status === "IN_PROGRESS") {
        return reply.code(409).send({ error: "Task is already running. Use /retry to force-retry." });
      }

      if (task.status === "COMPLETED") {
        return reply.code(409).send({ error: "Task is already completed" });
      }

      if (!task.agentName) {
        return reply
          .code(400)
          .send({ error: "Task has no assigned agent — cannot execute automatically" });
      }

      // Pre-check credits before queuing
      const creditCost = ACTION_CREDITS[task.agentName] ?? 5;
      if (creditCost > 0) {
        const userId = await getProjectOwner(task.projectId);
        if (userId) {
          const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { credits: true },
          });
          const credits = user?.credits ?? 0;
          if (credits < creditCost) {
            return reply.code(402).send({
              error: `Insufficient credits. This task requires ${creditCost} credits but you have ${credits}. Please top up to continue.`,
            });
          }
        }
      }

      await enqueueTaskExecution({
        taskId: task.id,
        projectId: task.projectId,
        agentName: task.agentName,
        taskTitle: task.title,
        taskDescription: task.description,
      });

      return reply.send({
        message: `Task "${task.title}" queued for immediate execution`,
        taskId: task.id,
        agentName: task.agentName,
      });
    }
  );
}
