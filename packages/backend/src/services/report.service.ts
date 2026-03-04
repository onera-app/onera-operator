import { prisma } from "@onera/database";

export async function createDailyReport(data: {
  projectId: string;
  content: string;
  tasksCompleted?: string;
  tasksPlanned?: string;
  metrics?: string;
}) {
  // Calculate day number since project creation
  const project = await prisma.project.findUnique({
    where: { id: data.projectId },
    select: { createdAt: true },
  });

  const createdAt = project?.createdAt ?? new Date();
  const now = new Date();
  const diffMs = now.getTime() - createdAt.getTime();
  const day = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1);

  return prisma.dailyReport.create({
    data: { ...data, day },
  });
}

export async function getLatestReport(projectId: string) {
  return prisma.dailyReport.findFirst({
    where: { projectId },
    orderBy: { date: "desc" },
  });
}

export async function listReports(projectId: string, limit = 30) {
  return prisma.dailyReport.findMany({
    where: { projectId },
    orderBy: { date: "desc" },
    take: limit,
  });
}
