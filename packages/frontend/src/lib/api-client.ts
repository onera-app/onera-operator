const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

async function fetchApi<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
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
    list: (userId?: string) =>
      fetchApi<Project[]>(
        `/api/projects${userId ? `?userId=${encodeURIComponent(userId)}` : ""}`
      ),
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
        { method: "POST" }
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
    credits: (userId: string) =>
      fetchApi<{ credits: number }>(`/api/users/${encodeURIComponent(userId)}/credits`),
  },

  billing: {
    summary: (userId: string) =>
      fetchApi<BillingSummary>(`/api/billing/${encodeURIComponent(userId)}`),
    history: (userId: string, limit?: number) =>
      fetchApi<{ transactions: CreditTransaction[] }>(
        `/api/billing/${encodeURIComponent(userId)}/history${limit ? `?limit=${limit}` : ""}`
      ),
    addCard: (userId: string) =>
      fetchApi<{ checkoutUrl: string }>("/api/billing/add-card", {
        method: "POST",
        body: JSON.stringify({ userId }),
      }),
    purchase: (userId: string, packSlug: string) =>
      fetchApi<{ checkoutUrl: string }>("/api/billing/purchase", {
        method: "POST",
        body: JSON.stringify({ userId, packSlug }),
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
  userId?: string;
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
  hasCard: boolean;
  autoChargeEnabled: boolean;
  recentTransactions: CreditTransaction[];
  packs: CreditPack[];
}

export const publicApi = {
  live: () => fetchApi<PublicLiveData>("/api/public/live"),
  ask: (question: string) =>
    fetchApi<{ answer: string }>("/api/public/ask", {
      method: "POST",
      body: JSON.stringify({ question }),
    }),
};
