export { prisma } from "./client.js";
export { PrismaClient } from "@prisma/client";

// Re-export generated types from Prisma
export type {
  User,
  Project,
  Task,
  ExecutionLog,
  AgentStatus,
  DailyReport,
} from "@prisma/client";

export {
  TaskCategory,
  TaskPriority,
  TaskStatus,
} from "@prisma/client";
