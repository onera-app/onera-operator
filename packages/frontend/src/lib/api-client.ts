const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

// ---------------------------------------------------------------------------
// Auth token injection — set by useApiAuth() hook from Clerk session
// ---------------------------------------------------------------------------

let _getToken: (() => Promise<string | null>) | null = null;

/**
 * Called once from the root layout to inject Clerk's getToken function.
 * This allows the api-client to attach Authorization headers automatically.
 */
export function setAuthTokenGetter(fn: () => Promise<string | null>) {
  _getToken = fn;
}

async function fetchApi<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  // Get Clerk session token if available
  const token = _getToken ? await _getToken() : null;

  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || `API error: ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// Projects
export const api = {
  projects: {
    list: () =>
      fetchApi<Project[]>("/api/projects"),
    get: (id: string) => fetchApi<Project>(`/api/projects/${id}`),
    create: (data: CreateProjectData) =>
      fetchApi<Project>("/api/projects", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<CreateProjectData>) =>
      fetchApi<Project>(`/api/projects/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      fetchApi<void>(`/api/projects/${id}`, { method: "DELETE" }),
    emails: (projectId: string, opts?: { status?: string; limit?: number }) => {
      const params = new URLSearchParams();
      if (opts?.status) params.set("status", opts.status);
      if (opts?.limit) params.set("limit", String(opts.limit));
      const query = params.toString();
      return fetchApi<EmailLogEntry[]>(`/api/projects/${projectId}/emails${query ? `?${query}` : ""}`);
    },
  },

  tasks: {
    list: (filters?: TaskFilters) => {
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined) params.set(key, String(value));
        });
      }
      const query = params.toString();
      return fetchApi<Task[]>(`/api/tasks${query ? `?${query}` : ""}`);
    },
    get: (id: string) => fetchApi<Task>(`/api/tasks/${id}`),
    create: (data: CreateTaskData) =>
      fetchApi<Task>("/api/tasks", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    updateStatus: (id: string, status: string, result?: string) =>
      fetchApi<Task>(`/api/tasks/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, result }),
      }),
    execute: (id: string) =>
      fetchApi<{ message: string; taskId: string; agentName: string }>(
        `/api/tasks/${id}/execute`,
        { method: "POST", body: JSON.stringify({}) }
      ),
    metrics: (projectId: string) =>
      fetchApi<TaskMetrics>(`/api/tasks/metrics?projectId=${projectId}`),
  },

  agents: {
    list: () => fetchApi<AgentStatus[]>("/api/agents"),
    logs: (limit?: number) =>
      fetchApi<ExecutionLog[]>(
        `/api/agents/logs${limit ? `?limit=${limit}` : ""}`
      ),
    trigger: (name: string, projectId: string) =>
      fetchApi<{ message: string; queued: number; agentName?: string }>(
        `/api/agents/${name}/trigger`,
        { method: "POST", body: JSON.stringify({ projectId }) }
      ),
  },

  reports: {
    list: (projectId: string, limit?: number) =>
      fetchApi<DailyReport[]>(
        `/api/reports?projectId=${projectId}${limit ? `&limit=${limit}` : ""}`
      ),
    latest: (projectId: string) =>
      fetchApi<DailyReport>(`/api/reports/latest?projectId=${projectId}`),
    generate: (projectId?: string) =>
      fetchApi<{ message: string }>("/api/reports/generate", {
        method: "POST",
        body: JSON.stringify({ projectId }),
      }),
  },

  users: {
    credits: () =>
      fetchApi<{ credits: number }>("/api/users/me/credits"),
  },

  billing: {
    summary: () =>
      fetchApi<BillingSummary>("/api/billing/me"),
    history: (limit?: number) =>
      fetchApi<{ transactions: CreditTransaction[] }>(
        `/api/billing/me/history${limit ? `?limit=${limit}` : ""}`
      ),
    subscribe: () =>
      fetchApi<{ checkoutUrl: string }>("/api/billing/subscribe", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    purchase: (packSlug: string) =>
      fetchApi<{ checkoutUrl: string }>("/api/billing/purchase", {
        method: "POST",
        body: JSON.stringify({ packSlug }),
      }),
  },

  loop: {
    trigger: (projectId?: string) =>
      fetchApi<{ message: string }>("/api/loop/trigger", {
        method: "POST",
        body: JSON.stringify({ projectId }),
      }),
  },

  activity: (projectId?: string) =>
    fetchApi<{ lines: string[] }>(
      `/api/activity${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ""}`
    ),

  admin: {
    tweets: {
      list: (filters?: { status?: string; projectId?: string; page?: number; limit?: number }) => {
        const params = new URLSearchParams();
        if (filters) {
          Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined) params.set(key, String(value));
          });
        }
        const query = params.toString();
        return fetchApi<QueuedTweetsResponse>(`/api/admin/tweets${query ? `?${query}` : ""}`);
      },
      update: (id: string, data: { content?: string; status?: string }) =>
        fetchApi<QueuedTweet>(`/api/admin/tweets/${id}`, {
          method: "PATCH",
          body: JSON.stringify(data),
        }),
      regenerate: (id: string) =>
        fetchApi<QueuedTweet>(`/api/admin/tweets/${id}/regenerate`, {
          method: "POST",
        }),
    },
  },

  health: () => fetchApi<HealthCheck>("/api/health"),
};

// Types for the API client
export interface Project {
  id: string;
  name: string;
  description: string | null;
  product: string | null;
  targetUsers: string | null;
  competitors: string | null;
  goals: string | null;
  website: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectData {
  name: string;
  description?: string;
  product?: string;
  targetUsers?: string;
  competitors?: string;
  goals?: string;
  website?: string;
  autoResearch?: boolean;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  automatable: boolean;
  agentName: string | null;
  result: string | null;
  scheduledFor: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  project?: { name: string };
}

export interface CreateTaskData {
  projectId: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  automatable?: boolean;
  agentName?: string;
}

export interface TaskFilters {
  projectId?: string;
  status?: string;
  category?: string;
  priority?: string;
  automatable?: boolean;
}

export interface TaskMetrics {
  completed: number;
  pending: number;
  failed: number;
  inProgress: number;
  completedToday: number;
  tweetsPostedToday: number;
  emailsSentToday: number;
}

export interface EmailLogEntry {
  id: string;
  projectId: string;
  azureMessageId: string | null;
  fromEmail: string;
  toEmail: string;
  replyTo: string | null;
  subject: string;
  body: string;
  status: "SENT" | "FAILED" | "BLOCKED";
  errorMessage: string | null;
  type: "OUTREACH" | "DIGEST" | "NOTIFICATION";
  sentAt: string;
}

export interface AgentStatus {
  id: string;
  name: string;
  displayName: string;
  status: string;
  lastRunAt: string | null;
  lastError: string | null;
  tasksCompleted: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionLog {
  id: string;
  taskId: string;
  agentName: string;
  action: string;
  input: string | null;
  output: string | null;
  status: string;
  duration: number | null;
  createdAt: string;
  task?: { title: string; projectId: string };
}

export interface DailyReport {
  id: string;
  projectId: string;
  day: number;
  date: string;
  content: string;
  tasksCompleted: string | null;
  tasksPlanned: string | null;
  metrics: string | null;
  createdAt: string;
}

export interface HealthCheck {
  status: string;
  timestamp: string;
  checks: Record<string, string>;
}

// ─── Public live dashboard types ─────────────────────────────────────────────

export interface PublicAgentStatus {
  name: string;
  displayName: string;
  status: string;
  lastRunAt: string | null;
  tasksCompleted: number;
}

export interface PublicTask {
  id: string;
  title: string;
  description: string | null;
  category: string;
  status: string;
  agentName: string | null;
  updatedAt: string;
  completedAt: string | null;
  createdAt: string;
  projectSlug: string;
}

export interface PublicTweet {
  text: string;
  postedAt: string;
}

export interface PublicEmail {
  subject: string;
  to: string;
  sentAt: string;
}

export interface TerminalLine {
  text: string;
  status: string;
  timestamp: string;
}

export interface PublicLiveData {
  agents: PublicAgentStatus[];
  tasks: PublicTask[];
  tweets: PublicTweet[];
  emails: PublicEmail[];
  terminalLines: TerminalLine[];
  stats: {
    totalTasksCompleted: number;
    tasksLast24h: number;
    emailsSent: number;
    tweetsPosted: number;
    activeProjects: number;
  };
  hasRealData: boolean;
}

// ─── Billing types ───────────────────────────────────────────────────────────

export interface CreditPack {
  slug: string;
  name: string;
  credits: number;
  price: number; // in dollars
}

export interface CreditTransaction {
  id: string;
  userId: string;
  type: string;
  amount: number;
  balance: number;
  description: string;
  dodoPaymentId: string | null;
  packSlug: string | null;
  taskId: string | null;
  createdAt: string;
}

export interface BillingSummary {
  credits: number;
  hasSubscription: boolean;
  subscriptionStatus: string | null;
  isTrialing: boolean;
  trialEndsAt: string | null;
  hasCard: boolean;
  autoChargeEnabled: boolean;
  recentTransactions: CreditTransaction[];
  packs: CreditPack[];
}

export interface QueuedTweet {
  id: string;
  projectId: string;
  content: string;
  tone: string;
  status: "PENDING" | "POSTED" | "DELETED";
  generatedAt: string;
  postedAt: string | null;
  postedBy: string | null;
  updatedAt: string;
  project?: { name: string };
}

export interface QueuedTweetsResponse {
  tweets: QueuedTweet[];
  total: number;
  page: number;
  limit: number;
}

export const publicApi = {
  live: () => fetchApi<PublicLiveData>("/api/public/live"),
  ask: (question: string) =>
    fetchApi<{ answer: string }>("/api/public/ask", {
      method: "POST",
      body: JSON.stringify({ question }),
    }),
};
