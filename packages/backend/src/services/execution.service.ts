import { prisma } from "@onera/database";

export async function createExecutionLog(data: {
  taskId: string;
  agentName: string;
  action: string;
  input?: string;
  output?: string;
  status: "success" | "error";
  duration?: number;
}) {
  return prisma.executionLog.create({ data });
}

export async function getExecutionLogs(taskId: string) {
  return prisma.executionLog.findMany({
    where: { taskId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      taskId: true,
      agentName: true,
      action: true,
      status: true,
      duration: true,
      createdAt: true,
      // input/output EXCLUDED — large JSON blobs, not needed for list view
    },
  });
}

export async function getRecentExecutionLogs(limit = 50) {
  return prisma.executionLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      taskId: true,
      agentName: true,
      action: true,
      status: true,
      duration: true,
      createdAt: true,
      task: { select: { title: true, projectId: true } },
      // input/output EXCLUDED — large JSON blobs
    },
  });
}

export async function getAgentStatuses() {
  return prisma.agentStatus.findMany({
    orderBy: { name: "asc" },
  });
}

export async function upsertAgentStatus(
  name: string,
  displayName: string,
  data: {
    status?: string;
    lastRunAt?: Date;
    lastError?: string | null;
    tasksCompleted?: number;
  }
) {
  return prisma.agentStatus.upsert({
    where: { name },
    create: {
      name,
      displayName,
      ...data,
    },
    update: data,
  });
}

export async function incrementAgentTaskCount(name: string) {
  return prisma.agentStatus.update({
    where: { name },
    data: {
      tasksCompleted: { increment: 1 },
    },
  });
}
