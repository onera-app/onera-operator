import { prisma, TaskStatus, type TaskCategory, type TaskPriority } from "@onera/database";

export interface TaskFilters {
  projectId?: string;
  status?: string;
  category?: string;
  priority?: string;
  automatable?: boolean;
  agentName?: string;
}

export async function listTasks(filters: TaskFilters = {}) {
  const where: Record<string, unknown> = {};

  if (filters.projectId) where.projectId = filters.projectId;
  if (filters.status) where.status = filters.status;
  if (filters.category) where.category = filters.category;
  if (filters.priority) where.priority = filters.priority;
  if (filters.automatable !== undefined)
    where.automatable = filters.automatable;
  if (filters.agentName) where.agentName = filters.agentName;

  return prisma.task.findMany({
    where,
    orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
    include: {
      project: { select: { name: true } },
    },
  });
}

export async function getTask(id: string) {
  return prisma.task.findUnique({
    where: { id },
    include: {
      project: { select: { name: true } },
      executionLogs: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
}

export async function createTask(data: {
  projectId: string;
  title: string;
  description: string;
  category: TaskCategory;
  priority: TaskPriority;
  automatable?: boolean;
  agentName?: string;
  scheduledFor?: Date;
}) {
  return prisma.task.create({ data });
}

export async function createManyTasks(
  tasks: Array<{
    projectId: string;
    title: string;
    description: string;
    category: TaskCategory;
    priority: TaskPriority;
    automatable?: boolean;
    agentName?: string;
  }>
) {
  return prisma.task.createMany({ data: tasks });
}

export async function updateTaskStatus(
  id: string,
  status: string,
  result?: string
) {
  const data: Record<string, unknown> = { status };
  if (status === "COMPLETED") {
    data.completedAt = new Date();
  }
  if (result !== undefined) {
    data.result = result;
  }
  return prisma.task.update({ where: { id }, data });
}

export async function getTaskCredits(taskId: string): Promise<number> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { credits: true },
  });
  return task?.credits ?? 1;
}

export async function getPendingAutomatableTasks(projectId?: string) {
  const where: Record<string, unknown> = {
    status: TaskStatus.PENDING,
    automatable: true,
    agentName: { not: null },
  };
  if (projectId) where.projectId = projectId;

  return prisma.task.findMany({
    where,
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  });
}

export async function getRecentCompletedTasks(
  projectId: string,
  limit = 20
) {
  return prisma.task.findMany({
    where: {
      projectId,
      status: TaskStatus.COMPLETED,
    },
    orderBy: { completedAt: "desc" },
    take: limit,
  });
}

export async function getTaskMetrics(projectId: string) {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [completed, pending, failed, inProgress, completedToday] = await Promise.all([
    prisma.task.count({
      where: { projectId, status: TaskStatus.COMPLETED },
    }),
    prisma.task.count({
      where: { projectId, status: TaskStatus.PENDING },
    }),
    prisma.task.count({
      where: { projectId, status: TaskStatus.FAILED },
    }),
    prisma.task.count({
      where: { projectId, status: TaskStatus.IN_PROGRESS },
    }),
    prisma.task.count({
      where: {
        projectId,
        status: TaskStatus.COMPLETED,
        completedAt: { gte: since24h },
      },
    }),
  ]);

  return { completed, pending, failed, inProgress, completedToday };
}
