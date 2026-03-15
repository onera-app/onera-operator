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
    email: (projectId: string, emailId: string) =>
      fetchApi<EmailLogEntry & { body: string }>(`/api/projects/${projectId}/emails/${emailId}`),
    pause: (id: string, paused: boolean) =>
      fetchApi<Project>(`/api/projects/${id}/pause`, {
        method: "PATCH",
        body: JSON.stringify({ paused }),
      }),
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
    retry: (id: string) =>
      fetchApi<{ message: string; taskId: string; agentName: string }>(
        `/api/tasks/${id}/retry`,
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

  conversations: {
    list: (projectId: string, opts?: { status?: string; limit?: number; page?: number }) => {
      const params = new URLSearchParams();
      if (opts?.status) params.set("status", opts.status);
      if (opts?.limit) params.set("limit", String(opts.limit));
      if (opts?.page) params.set("page", String(opts.page));
      const query = params.toString();
      return fetchApi<ConversationsResponse>(`/api/projects/${projectId}/conversations${query ? `?${query}` : ""}`);
    },
    get: (projectId: string, convId: string) =>
      fetchApi<ConversationDetail>(`/api/projects/${projectId}/conversations/${convId}`),
    stats: (projectId: string) =>
      fetchApi<ConversationStats>(`/api/projects/${projectId}/conversations/stats`),
  },

  contacts: {
    list: (projectId: string, opts?: { limit?: number; page?: number; search?: string }) => {
      const params = new URLSearchParams();
      if (opts?.limit) params.set("limit", String(opts.limit));
      if (opts?.page) params.set("page", String(opts.page));
      if (opts?.search) params.set("search", opts.search);
      const query = params.toString();
      return fetchApi<ContactsResponse>(`/api/projects/${projectId}/contacts${query ? `?${query}` : ""}`);
    },
  },

  admin: {
    stats: () => fetchApi<AdminStats>("/api/admin/stats"),
    users: {
      list: (opts?: { page?: number; limit?: number; search?: string }) => {
        const params = new URLSearchParams();
        if (opts?.page) params.set("page", String(opts.page));
        if (opts?.limit) params.set("limit", String(opts.limit));
        if (opts?.search) params.set("search", opts.search);
        const query = params.toString();
        return fetchApi<AdminUsersResponse>(`/api/admin/users${query ? `?${query}` : ""}`);
      },
      get: (userId: string) => fetchApi<AdminUserDetail>(`/api/admin/users/${userId}`),
      adjustCredits: (userId: string, amount: number, description: string) =>
        fetchApi<{ credits: number; message: string }>(`/api/admin/users/${userId}/credits`, {
          method: "POST",
          body: JSON.stringify({ amount, description }),
        }),
    },
    projects: {
      list: (opts?: { page?: number; limit?: number; search?: string; userId?: string }) => {
        const params = new URLSearchParams();
        if (opts) {
          Object.entries(opts).forEach(([key, value]) => {
            if (value !== undefined) params.set(key, String(value));
          });
        }
        const query = params.toString();
        return fetchApi<AdminProjectsResponse>(`/api/admin/projects${query ? `?${query}` : ""}`);
      },
    },
    emails: {
      list: (opts?: { page?: number; limit?: number; status?: string; deliveryStatus?: string; direction?: string; projectId?: string }) => {
        const params = new URLSearchParams();
        if (opts) {
          Object.entries(opts).forEach(([key, value]) => {
            if (value !== undefined) params.set(key, String(value));
          });
        }
        const query = params.toString();
        return fetchApi<AdminEmailsResponse>(`/api/admin/emails${query ? `?${query}` : ""}`);
      },
    },
    tasks: {
      list: (opts?: { page?: number; limit?: number; status?: string; category?: string; agentName?: string; projectId?: string }) => {
        const params = new URLSearchParams();
        if (opts) {
          Object.entries(opts).forEach(([key, value]) => {
            if (value !== undefined) params.set(key, String(value));
          });
        }
        const query = params.toString();
        return fetchApi<AdminTasksResponse>(`/api/admin/tasks${query ? `?${query}` : ""}`);
      },
      update: (taskId: string, data: { status: string }) =>
        fetchApi<Task>(`/api/admin/tasks/${taskId}`, {
          method: "PATCH",
          body: JSON.stringify(data),
        }),
    },
    agents: () => fetchApi<AdminAgent[]>("/api/admin/agents"),
    billing: (opts?: { page?: number; limit?: number; type?: string }) => {
      const params = new URLSearchParams();
      if (opts) {
        Object.entries(opts).forEach(([key, value]) => {
          if (value !== undefined) params.set(key, String(value));
        });
      }
      const query = params.toString();
      return fetchApi<AdminBillingResponse>(`/api/admin/billing${query ? `?${query}` : ""}`);
    },
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
      update: (id: string, data: { content?: string; status?: string; tweetUrl?: string }) =>
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
  paused: boolean;
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
  summary: string | null;
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
  body?: string;
  htmlBody?: string;
  direction: "OUTBOUND" | "INBOUND";
  status: "SENT" | "FAILED" | "BLOCKED";
  deliveryStatus: "PENDING" | "DELIVERED" | "BOUNCED" | "OPENED" | "CLICKED" | "FAILED";
  errorMessage: string | null;
  type: "OUTREACH" | "DIGEST" | "NOTIFICATION" | "FOLLOW_UP" | "REPLY";
  conversationId: string | null;
  contactId: string | null;
  messageId?: string | null;
  inReplyTo?: string | null;
  sentAt: string;
}

// ─── Conversation types ──────────────────────────────────────────────────────

export interface Contact {
  id: string;
  projectId: string;
  email: string;
  name: string | null;
  company: string | null;
  role: string | null;
  companyUrl: string | null;
  source: "OUTREACH" | "MANUAL" | "INBOUND";
  createdAt: string;
  updatedAt: string;
}

export interface EmailConversation {
  id: string;
  projectId: string;
  contactId: string;
  subject: string;
  status: "ACTIVE" | "REPLIED" | "FOLLOW_UP" | "CLOSED";
  lastActivityAt: string;
  messageCount: number;
  createdAt: string;
  contact: Contact;
  emailLogs?: EmailLogEntry[];
}

export interface ConversationsResponse {
  conversations: (EmailConversation & {
    emailLogs: EmailLogEntry[];
  })[];
  total: number;
  page: number;
  limit: number;
}

export interface ConversationDetail extends EmailConversation {
  emailLogs: EmailLogEntry[];
}

export interface ConversationStats {
  conversations: { total: number; active: number; replied: number; followUp: number; closed: number };
  emails: { totalSent: number; totalReceived: number; delivered: number; bounced: number };
  rates: { replyRate: number; deliveryRate: number; bounceRate: number };
}

export interface ContactsResponse {
  contacts: (Contact & {
    _count: { conversations: number; emailLogs: number };
    conversations: { id: string; status: string; lastActivityAt: string }[];
  })[];
  total: number;
  page: number;
  limit: number;
}

// ─── Admin types ─────────────────────────────────────────────────────────────

export interface AdminStats {
  users: { total: number };
  projects: { total: number; active: number; paused: number };
  tasks: { total: number; completed: number; failed: number; today: number; failRate: number };
  emails: { total: number; today: number; conversations: number; replied: number; replyRate: number };
  tweets: { total: number; today: number };
  contacts: { total: number };
  credits: { totalInCirculation: number; consumedToday: number };
  agents: { name: string; displayName: string; status: string; lastRunAt: string | null; lastError: string | null; tasksCompleted: number }[];
}

export interface AdminUser {
  id: string;
  name: string | null;
  email: string | null;
  credits: number;
  subscriptionStatus: string | null;
  trialActivated: boolean;
  trialEndsAt: string | null;
  autoChargeEnabled: boolean;
  createdAt: string;
  _count: { projects: number; creditTransactions: number };
}

export interface AdminUserDetail extends AdminUser {
  projects: {
    id: string; name: string; website: string | null; paused: boolean;
    companyEmail: string | null; createdAt: string;
    _count: { tasks: number; emailLogs: number; tweetQueue: number };
  }[];
  creditTransactions: CreditTransaction[];
}

export interface AdminUsersResponse {
  users: AdminUser[];
  total: number;
  page: number;
  limit: number;
}

export interface AdminProject {
  id: string;
  name: string;
  website: string | null;
  paused: boolean;
  companyEmail: string | null;
  createdAt: string;
  updatedAt: string;
  user: { name: string | null; email: string | null };
  _count: { tasks: number; emailLogs: number; tweetQueue: number; contacts: number; emailConversations: number };
}

export interface AdminProjectsResponse {
  projects: AdminProject[];
  total: number;
  page: number;
  limit: number;
}

export interface AdminEmailEntry {
  id: string;
  projectId: string;
  fromEmail: string;
  toEmail: string;
  subject: string;
  direction: "OUTBOUND" | "INBOUND";
  status: "SENT" | "FAILED" | "BLOCKED";
  deliveryStatus: "PENDING" | "DELIVERED" | "BOUNCED" | "OPENED" | "CLICKED" | "FAILED";
  type: string;
  sentAt: string;
  project: { name: string } | null;
  contact: { name: string | null; company: string | null } | null;
  conversation: { id: string; status: string } | null;
}

export interface AdminEmailsResponse {
  emails: AdminEmailEntry[];
  total: number;
  page: number;
  limit: number;
}

export interface AdminTasksResponse {
  tasks: (Task & { project: { name: string } })[];
  total: number;
  page: number;
  limit: number;
}

export interface AdminAgent {
  id: string;
  name: string;
  displayName: string;
  status: string;
  lastRunAt: string | null;
  lastError: string | null;
  tasksCompleted: number;
  createdAt: string;
  updatedAt: string;
  recentLogs: {
    id: string; action: string; status: string; duration: number | null; createdAt: string;
    task: { title: string; projectId: string } | null;
  }[];
  totalExecutions: number;
  errorCount: number;
  errorRate: number;
}

export interface AdminBillingResponse {
  transactions: (CreditTransaction & { user: { name: string | null; email: string | null } })[];
  total: number;
  page: number;
  limit: number;
  summary: { totalCreditsInCirculation: number; activeSubscriptions: number; totalRevenue: number };
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

export interface PublicCompany {
  name: string;
  slug: string;
  taskCount: number;
  lastActive: string;
}

export interface PublicLiveData {
  agents: PublicAgentStatus[];
  tasks: PublicTask[];
  tweets: PublicTweet[];
  emails: PublicEmail[];
  terminalLines: TerminalLine[];
  companies: PublicCompany[];
  stats: {
    totalTasksCompleted: number;
    tasksLast24h: number;
    emailsSent: number;
    tweetsPosted: number;
    activeProjects: number;
    creditsConsumed: number;
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
  tweetUrl: string | null;
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
