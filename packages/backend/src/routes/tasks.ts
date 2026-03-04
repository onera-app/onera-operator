import type { FastifyInstance } from "fastify";
import {
  listTasks,
  getTask,
  createTask,
  updateTaskStatus,
  getTaskMetrics,
} from "../services/task.service.js";
import { getExecutionLogs } from "../services/execution.service.js";
import type { TaskCategory, TaskPriority } from "@onera/database";

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
    } catch {
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

}
