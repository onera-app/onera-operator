import { prisma } from "@onera/database";
import type { ProjectContext } from "@onera/shared";
import { recordSignupBonus } from "./billing.service.js";

export async function listProjects(userId?: string) {
  return prisma.project.findMany({
    where: userId ? { userId } : undefined,
    orderBy: { updatedAt: "desc" },
  });
}

export async function getProject(id: string) {
  return prisma.project.findUnique({ where: { id } });
}

export async function createProject(data: {
  userId: string;
  name: string;
  description?: string;
  product?: string;
  targetUsers?: string;
  competitors?: string;
  goals?: string;
  website?: string;
}) {
  return prisma.project.create({ data });
}

export async function updateProject(
  id: string,
  data: {
    name?: string;
    description?: string;
    product?: string;
    targetUsers?: string;
    competitors?: string;
    goals?: string;
    website?: string;
  }
) {
  return prisma.project.update({ where: { id }, data });
}

export async function deleteProject(id: string) {
  return prisma.project.delete({ where: { id } });
}

/**
 * Ensure a user exists in the database (upsert from OAuth profile).
 */
export async function ensureUser(data: {
  id: string;
  email: string;
  name?: string;
  image?: string;
}) {
  // Check if user already exists
  const existing = await prisma.user.findUnique({ where: { id: data.id } });

  const user = await prisma.user.upsert({
    where: { id: data.id },
    create: {
      id: data.id,
      email: data.email,
      name: data.name,
      image: data.image,
      credits: 50,
    },
    update: {
      name: data.name,
      image: data.image,
    },
  });

  // Record signup bonus for new users
  if (!existing) {
    await recordSignupBonus(user.id).catch(() => {});
  }

  return user;
}

export async function getUserCredits(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { credits: true },
  });
  return user?.credits ?? 0;
}

export async function deductCredits(
  userId: string,
  amount: number
): Promise<boolean> {
  // Atomic decrement: only updates if credits >= amount, preventing race conditions
  const result = await prisma.user.updateMany({
    where: { id: userId, credits: { gte: amount } },
    data: { credits: { decrement: amount } },
  });
  return result.count > 0;
}

/**
 * Get the owner (userId) of a project.
 */
export async function getProjectOwner(
  projectId: string
): Promise<string | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { userId: true },
  });
  return project?.userId ?? null;
}

/**
 * Build a text-based context string from a project, suitable for passing
 * into LLM prompts.
 */
export async function buildProjectContext(
  projectId: string
): Promise<string> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  const parts = [`Startup Name: ${project.name}`];

  if (project.description) parts.push(`Description: ${project.description}`);
  if (project.product) parts.push(`Product: ${project.product}`);
  if (project.targetUsers) parts.push(`Target Users: ${project.targetUsers}`);
  if (project.website) parts.push(`Website: ${project.website}`);

  if (project.competitors) {
    try {
      const competitors = JSON.parse(project.competitors);
      if (Array.isArray(competitors)) {
        parts.push(`Competitors: ${competitors.join(", ")}`);
      } else {
        parts.push(`Competitors: ${project.competitors}`);
      }
    } catch {
      parts.push(`Competitors: ${project.competitors}`);
    }
  }

  if (project.goals) {
    try {
      const goals = JSON.parse(project.goals);
      if (Array.isArray(goals)) {
        parts.push(`Goals:\n${goals.map((g: string) => `- ${g}`).join("\n")}`);
      } else {
        parts.push(`Goals: ${project.goals}`);
      }
    } catch {
      parts.push(`Goals: ${project.goals}`);
    }
  }

  return parts.join("\n");
}

export function projectToContext(project: {
  name: string;
  description: string | null;
  product: string | null;
  targetUsers: string | null;
  competitors: string | null;
  goals: string | null;
  website: string | null;
}): ProjectContext {
  let competitors: string[] = [];
  if (project.competitors) {
    try {
      const parsed = JSON.parse(project.competitors);
      competitors = Array.isArray(parsed) ? parsed : [project.competitors];
    } catch {
      competitors = [project.competitors];
    }
  }

  let goals: string[] = [];
  if (project.goals) {
    try {
      const parsed = JSON.parse(project.goals);
      goals = Array.isArray(parsed) ? parsed : [project.goals];
    } catch {
      goals = [project.goals];
    }
  }

  return {
    name: project.name,
    description: project.description || "",
    product: project.product || "",
    targetUsers: project.targetUsers || "",
    competitors,
    goals,
    website: project.website || "",
  };
}
