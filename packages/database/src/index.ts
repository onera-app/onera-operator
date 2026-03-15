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
  TweetQueue,
  EmailLog,
  Contact,
  EmailConversation,
} from "@prisma/client";

export {
  TaskCategory,
  TaskPriority,
  TaskStatus,
  TweetQueueStatus,
  EmailLogStatus,
  EmailLogType,
  EmailDirection,
  EmailDeliveryStatus,
  ConversationStatus,
  ContactSource,
} from "@prisma/client";
