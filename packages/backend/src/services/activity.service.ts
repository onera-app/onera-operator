import IORedis from "ioredis";

// ─── Agent Activity Events ──────────────────────────────────────
// Published to Redis pub/sub for real-time streaming to the frontend.

export interface AgentEvent {
  type: "step" | "thinking" | "tool_call" | "tool_result" | "started" | "completed" | "failed" | "info";
  agentName: string;
  taskId: string;
  taskTitle: string;
  projectId: string;
  message: string;
  data?: unknown;
  timestamp: string;
}

const CHANNEL = "agent:activity";

let publisher: IORedis | null = null;

function getPublisher(): IORedis | null {
  if (publisher) return publisher;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;

  const isTls = redisUrl.startsWith("rediss://");
  publisher = new IORedis(redisUrl, {
    tls: isTls ? { rejectUnauthorized: false } : undefined,
    enableReadyCheck: false,
    connectTimeout: 5000,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });

  publisher.connect().catch((err) => {
    console.warn("[activity] Redis publisher connection failed:", err.message || err);
    publisher = null;
  });

  return publisher;
}

/** Publish an agent activity event to Redis pub/sub */
export function publishAgentEvent(event: Omit<AgentEvent, "timestamp">) {
  const pub = getPublisher();
  if (!pub) return;

  const fullEvent: AgentEvent = {
    ...event,
    timestamp: new Date().toISOString(),
  };

  pub.publish(CHANNEL, JSON.stringify(fullEvent)).catch((err) => {
    console.warn("[activity] Redis publish failed:", err.message || err);
  });
}

/** Create a Redis subscriber for agent activity events */
export function createActivitySubscriber(
  onEvent: (event: AgentEvent) => void
): { unsubscribe: () => void } {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return { unsubscribe: () => {} };
  }

  const isTls = redisUrl.startsWith("rediss://");
  const subscriber = new IORedis(redisUrl, {
    tls: isTls ? { rejectUnauthorized: false } : undefined,
    enableReadyCheck: false,
    connectTimeout: 5000,
    maxRetriesPerRequest: 3,
  });

  subscriber.subscribe(CHANNEL).catch((err) => {
    console.warn("[activity] Redis subscribe failed:", err.message || err);
  });

  subscriber.on("message", (_channel, message) => {
    try {
      const event = JSON.parse(message) as AgentEvent;
      onEvent(event);
    } catch {
      // ignore malformed messages
    }
  });

  return {
    unsubscribe: () => {
      subscriber.unsubscribe(CHANNEL).catch(() => {});
      subscriber.quit().catch(() => {});
    },
  };
}
