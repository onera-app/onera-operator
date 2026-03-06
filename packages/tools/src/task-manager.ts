import { tool } from "ai";
import { z } from "zod";

interface TaskToolContext {
  projectId?: string;
  userId?: string;
  apiBaseUrl?: string;
}

const categoryEnum = z.enum([
  "GROWTH",
  "MARKETING",
  "OUTREACH",
  "PRODUCT",
  "ANALYTICS",
  "OPERATIONS",
  "RESEARCH",
  "ENGINEERING",
  "TWITTER",
]);

const priorityEnum = z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]);
const statusEnum = z.enum([
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
]);

type JsonRecord = Record<string, unknown>;

async function requestApi<T>(
  baseUrl: string,
  path: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || `API error (${response.status})`);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

async function resolveProjectId(
  context: TaskToolContext,
  requestedProjectId?: string
) {
  if (requestedProjectId) return requestedProjectId;
  if (context.projectId) return context.projectId;
  if (!context.userId) {
    throw new Error("Missing projectId. Please provide a project id.");
  }

  const baseUrl = context.apiBaseUrl || "http://localhost:3001";
  const projects = await requestApi<Array<{ id: string }>>(
    baseUrl,
    `/api/projects?userId=${encodeURIComponent(context.userId)}`
  );

  if (projects.length === 0) {
    throw new Error("No project found. Create a project first.");
  }
  return projects[0]!.id;
}

async function assertProjectAccess(context: TaskToolContext, projectId: string) {
  if (!context.userId) return;
  const baseUrl = context.apiBaseUrl || "http://localhost:3001";
  const project = await requestApi<JsonRecord>(baseUrl, `/api/projects/${projectId}`);
  if (project.userId !== context.userId) {
    throw new Error("Access denied for this project.");
  }
}

async function assertTaskAccess(context: TaskToolContext, taskId: string) {
  const baseUrl = context.apiBaseUrl || "http://localhost:3001";
  const task = await requestApi<JsonRecord>(baseUrl, `/api/tasks/${taskId}`);
  const projectId = String(task.projectId || "");
  if (!projectId) {
    throw new Error("Task is missing project linkage.");
  }
  await assertProjectAccess(context, projectId);
}

export function createTaskManagerTools(context: TaskToolContext) {
  const baseUrl = context.apiBaseUrl || "http://localhost:3001";

  const listProjectTasks = tool({
    description:
      "List project tasks. Use this first if you need ids before editing tasks.",
    parameters: z.object({
      projectId: z.string().optional(),
      status: statusEnum.optional(),
      category: categoryEnum.optional(),
      limit: z.number().min(1).max(50).optional(),
    }),
    execute: async ({ projectId, status, category, limit }) => {
      const resolvedProjectId = await resolveProjectId(context, projectId);
      await assertProjectAccess(context, resolvedProjectId);

      const params = new URLSearchParams({ projectId: resolvedProjectId });
      if (status) params.set("status", status);
      if (category) params.set("category", category);

      const tasks = await requestApi<JsonRecord[]>(
        baseUrl,
        `/api/tasks?${params.toString()}`
      );

      return {
        projectId: resolvedProjectId,
        count: tasks.length,
        tasks: tasks.slice(0, limit ?? 20).map((t) => ({
          id: t.id,
          title: t.title,
          category: t.category,
          priority: t.priority,
          status: t.status,
          agentName: t.agentName,
        })),
      };
    },
  });

  const createProjectTask = tool({
    description:
      "Create a new task for the project backlog with category, priority, and optional agent.",
    parameters: z.object({
      projectId: z.string().optional(),
      title: z.string().min(3),
      description: z.string().min(8),
      category: categoryEnum.default("OPERATIONS"),
      priority: priorityEnum.default("MEDIUM"),
      automatable: z.boolean().optional(),
      agentName: z.string().optional(),
    }),
    execute: async ({
      projectId,
      title,
      description,
      category,
      priority,
      automatable,
      agentName,
    }) => {
      const resolvedProjectId = await resolveProjectId(context, projectId);
      await assertProjectAccess(context, resolvedProjectId);

      const created = await requestApi<JsonRecord>(baseUrl, "/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          projectId: resolvedProjectId,
          title,
          description,
          category,
          priority,
          automatable: automatable ?? true,
          agentName,
        }),
      });

      return {
        message: `Created task "${String(created.title)}"`,
        task: {
          id: created.id,
          title: created.title,
          category: created.category,
          priority: created.priority,
          status: created.status,
        },
      };
    },
  });

  const updateProjectTask = tool({
    description:
      "Update task fields like title, description, category, priority, status, automatable, and agentName.",
    parameters: z.object({
      taskId: z.string(),
      title: z.string().optional(),
      description: z.string().optional(),
      category: categoryEnum.optional(),
      priority: priorityEnum.optional(),
      status: statusEnum.optional(),
      automatable: z.boolean().optional(),
      agentName: z.string().nullable().optional(),
    }),
    execute: async ({
      taskId,
      title,
      description,
      category,
      priority,
      status,
      automatable,
      agentName,
    }) => {
      await assertTaskAccess(context, taskId);

      const payload = {
        title,
        description,
        category,
        priority,
        status,
        automatable,
        agentName,
      };

      if (Object.values(payload).every((value) => value === undefined)) {
        return { message: "No changes requested." };
      }

      const updated = await requestApi<JsonRecord>(baseUrl, `/api/tasks/${taskId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      return {
        message: `Updated task "${String(updated.title)}"`,
        task: {
          id: updated.id,
          title: updated.title,
          category: updated.category,
          priority: updated.priority,
          status: updated.status,
          agentName: updated.agentName,
        },
      };
    },
  });

  const deleteProjectTask = tool({
    description:
      "Delete a task from backlog. Only use when user explicitly confirms deletion.",
    parameters: z.object({
      taskId: z.string(),
      confirm: z.boolean().describe("Must be true to proceed with deletion"),
    }),
    execute: async ({ taskId, confirm }) => {
      if (!confirm) {
        return { message: "Deletion not confirmed. No task deleted." };
      }
      await assertTaskAccess(context, taskId);
      await requestApi<void>(baseUrl, `/api/tasks/${taskId}`, {
        method: "DELETE",
      });
      return { message: `Deleted task ${taskId}` };
    },
  });

  const executeProjectTask = tool({
    description:
      "Execute a task immediately by queuing it for its assigned agent. " +
      "The task must have an assigned agent and be in PENDING or FAILED status. " +
      "Use when the user says 'run this now', 'do this task', 'execute it', etc.",
    parameters: z.object({
      taskId: z.string().describe("The ID of the task to execute"),
    }),
    execute: async ({ taskId }) => {
      await assertTaskAccess(context, taskId);

      const result = await requestApi<{
        message: string;
        taskId: string;
        agentName: string;
      }>(baseUrl, `/api/tasks/${taskId}/execute`, {
        method: "POST",
      });

      return {
        message: result.message,
        taskId: result.taskId,
        agentName: result.agentName,
      };
    },
  });

  return {
    listProjectTasks,
    createProjectTask,
    updateProjectTask,
    deleteProjectTask,
    executeProjectTask,
  };
}
