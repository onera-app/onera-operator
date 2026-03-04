import { Queue } from "bullmq";
import { getRedisConnection } from "./connection.js";

export interface TaskExecutionJob {
  taskId: string;
  projectId: string;
  agentName: string;
  taskTitle: string;
  taskDescription: string;
}

let taskQueue: Queue<TaskExecutionJob> | null = null;

export function getTaskQueue(): Queue<TaskExecutionJob> {
  if (!taskQueue) {
    taskQueue = new Queue<TaskExecutionJob>("task-execution", {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      },
    });
  }
  return taskQueue;
}

export async function enqueueTaskExecution(
  job: TaskExecutionJob
): Promise<void> {
  const queue = getTaskQueue();
  await queue.add(`execute-${job.agentName}-${job.taskId}`, job, {
    jobId: job.taskId, // Deduplicate: BullMQ ignores duplicate jobIds already in queue
  });
  console.log(
    `[onera-queue] Enqueued task "${job.taskTitle}" for agent "${job.agentName}"`
  );
}
