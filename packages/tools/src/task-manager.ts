import { tool } from "ai";
import { z } from "zod";

interface TaskToolContext {
  projectId?: string;
  userId?: string;
  apiBaseUrl?: string;
  authToken?: string;
  /** Internal service secret for backend→backend calls (bypasses JWT) */
  internalSecret?: string;
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
  options?: RequestInit,
  authToken?: string,
  internalAuth?: { secret: string; userId: string }
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };

  // Prefer internal auth (never expires) over JWT (can expire mid-stream)
  if (internalAuth) {
    headers["X-Internal-Secret"] = internalAuth.secret;
    headers["X-Internal-User-Id"] = internalAuth.userId;
  } else if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || `API error (${response.status})`);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** Build internal auth headers from context (preferred over JWT which expires) */
function getInternalAuth(context: TaskToolContext) {
  if (context.internalSecret && context.userId) {
    return { secret: context.internalSecret, userId: context.userId };
  }
  return undefined;
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
    `/api/projects?userId=${encodeURIComponent(context.userId)}`,
    undefined,
    context.authToken,
    getInternalAuth(context)
  );

  if (projects.length === 0) {
    throw new Error("No project found. Create a project first.");
  }
  return projects[0]!.id;
}

async function assertProjectAccess(context: TaskToolContext, projectId: string) {
  if (!context.userId) return;
  const baseUrl = context.apiBaseUrl || "http://localhost:3001";
  const project = await requestApi<JsonRecord>(
    baseUrl,
    `/api/projects/${projectId}`,
    undefined,
    context.authToken,
    getInternalAuth(context)
  );
  if (project.userId !== context.userId) {
    throw new Error("Access denied for this project.");
  }
}

async function assertTaskAccess(context: TaskToolContext, taskId: string) {
  const baseUrl = context.apiBaseUrl || "http://localhost:3001";
  const task = await requestApi<JsonRecord>(
    baseUrl,
    `/api/tasks/${taskId}`,
    undefined,
    context.authToken,
    getInternalAuth(context)
  );
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
      projectId: z.string().describe("The project ID. Use an empty string to auto-resolve from context."),
      status: z.enum([
        "PENDING", "IN_PROGRESS", "COMPLETED", "FAILED", "CANCELLED", "ALL",
      ]).describe("Filter by status. Use 'ALL' to list all statuses."),
      category: z.enum([
        "GROWTH", "MARKETING", "OUTREACH", "PRODUCT", "ANALYTICS",
        "OPERATIONS", "RESEARCH", "ENGINEERING", "TWITTER", "ALL",
      ]).describe("Filter by category. Use 'ALL' to list all categories."),
      limit: z.number().min(1).max(50).describe("Maximum number of tasks to return. Use 20 for a standard list."),
    }),
    execute: async ({ projectId: rawProjectId, status: rawStatus, category: rawCategory, limit }) => {
      const projectId = rawProjectId.length > 0 ? rawProjectId : undefined;
      const status = rawStatus === "ALL" ? undefined : rawStatus;
      const category = rawCategory === "ALL" ? undefined : rawCategory;
      const resolvedProjectId = await resolveProjectId(context, projectId);
      await assertProjectAccess(context, resolvedProjectId);

      const params = new URLSearchParams({ projectId: resolvedProjectId });
      if (status) params.set("status", status);
      if (category) params.set("category", category);

      const tasks = await requestApi<JsonRecord[]>(
        baseUrl,
        `/api/tasks?${params.toString()}`,
        undefined,
        context.authToken,
        getInternalAuth(context)
      );

      return {
        projectId: resolvedProjectId,
        count: tasks.length,
        tasks: tasks.slice(0, limit).map((t) => ({
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
      "Create a new task for the project backlog with category, priority, and agent.",
    parameters: z.object({
      projectId: z.string().describe("The project ID. Use an empty string to auto-resolve from context."),
      title: z.string().min(3).describe("Task title (min 3 chars)."),
      description: z.string().min(8).describe("Task description (min 8 chars)."),
      category: categoryEnum.describe("Task category."),
      priority: priorityEnum.describe("Task priority level."),
      automatable: z.boolean().describe("Whether this task can be automated by an agent. Use true if unsure."),
      agentName: z.string().describe("Agent to assign. Use an empty string for no agent assignment."),
    }),
    execute: async ({
      projectId: rawProjectId,
      title,
      description,
      category,
      priority,
      automatable,
      agentName: rawAgentName,
    }) => {
      const projectId = rawProjectId.length > 0 ? rawProjectId : undefined;
      const agentName = rawAgentName.length > 0 ? rawAgentName : undefined;
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
          automatable,
          agentName,
        }),
      }, context.authToken, getInternalAuth(context));

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
      "Update task fields. Set any field to its sentinel value to leave it unchanged: " +
      "empty string for text fields, 'UNCHANGED' for enums, -1 for automatable (treat as unchanged).",
    parameters: z.object({
      taskId: z.string().describe("The ID of the task to update."),
      title: z.string().describe("New title. Use an empty string to leave unchanged."),
      description: z.string().describe("New description. Use an empty string to leave unchanged."),
      category: z.enum([
        "GROWTH", "MARKETING", "OUTREACH", "PRODUCT", "ANALYTICS",
        "OPERATIONS", "RESEARCH", "ENGINEERING", "TWITTER", "UNCHANGED",
      ]).describe("New category. Use 'UNCHANGED' to leave unchanged."),
      priority: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW", "UNCHANGED"])
        .describe("New priority. Use 'UNCHANGED' to leave unchanged."),
      status: z.enum([
        "PENDING", "IN_PROGRESS", "COMPLETED", "FAILED", "CANCELLED", "UNCHANGED",
      ]).describe("New status. Use 'UNCHANGED' to leave unchanged."),
      automatable: z.string().describe("'true', 'false', or 'unchanged'. Whether the task can be automated."),
      agentName: z.string().describe("New agent name. Use an empty string to leave unchanged, or 'none' to unassign."),
    }),
    execute: async ({
      taskId,
      title: rawTitle,
      description: rawDescription,
      category: rawCategory,
      priority: rawPriority,
      status: rawStatus,
      automatable: rawAutomatable,
      agentName: rawAgentName,
    }) => {
      await assertTaskAccess(context, taskId);

      const title = rawTitle.length > 0 ? rawTitle : undefined;
      const description = rawDescription.length > 0 ? rawDescription : undefined;
      const category = rawCategory !== "UNCHANGED" ? rawCategory : undefined;
      const priority = rawPriority !== "UNCHANGED" ? rawPriority : undefined;
      const status = rawStatus !== "UNCHANGED" ? rawStatus : undefined;
      const automatable = rawAutomatable === "unchanged" ? undefined : rawAutomatable === "true";
      const agentName = rawAgentName === "" ? undefined : rawAgentName === "none" ? null : rawAgentName;

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
      }, context.authToken, getInternalAuth(context));

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
      }, context.authToken, getInternalAuth(context));
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
        body: JSON.stringify({}),
      }, context.authToken, getInternalAuth(context));

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
