import axios, { type AxiosInstance } from 'axios';

// Use relative URL to leverage nginx proxy
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

let csrfToken: string | null = null;

async function getCsrfToken(): Promise<string | null> {
  if (csrfToken) return csrfToken;
  try {
    const response = await fetch(`${API_BASE_URL}/csrf-token`);
    if (!response.ok) return null;
    const data = await response.json() as { token?: string; csrfToken?: string };
    csrfToken = data.token || data.csrfToken || null;
    return csrfToken;
  } catch {
    return null;
  }
}

// Protected endpoints that require authentication
const PROTECTED_ENDPOINTS = ['/logs', '/audit-log', '/tasks/', '/federation'];

// Request interceptor to add auth header for protected endpoints
api.interceptors.request.use((config) => {
  // Check if this is a protected endpoint
  const isProtected = PROTECTED_ENDPOINTS.some(endpoint =>
    config.url?.startsWith(endpoint) || config.url?.includes(endpoint)
  );

  if (isProtected) {
    // Use session token (preferred) instead of password
    const sessionToken = localStorage.getItem('app_session_token');
    if (sessionToken) {
      config.headers['X-Session-Token'] = sessionToken;
    }
  }

  return config;
});

// CSRF token for mutating requests (POST/PUT/PATCH/DELETE)
api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase();
  const needsCsrf = ['post', 'put', 'patch', 'delete'].includes(method);
  const isAuthEndpoint = config.url?.startsWith('/auth/') || config.url?.includes('/auth/');

  if (needsCsrf && !isAuthEndpoint) {
    const token = await getCsrfToken();
    if (token) {
      config.headers['X-CSRF-Token'] = token;
    }
  }

  return config;
});

// API response types
export interface StatusResponse {
  node: NodeStatus;
  container: ContainerInfo;
  stats: ContainerStats;
}

export interface NodeStatus {
  address?: string;
  current_slots?: number;
  total_slots?: number;
}

export interface ContainerInfo {
  running: boolean;
  startedAt?: string;
}

export interface ContainerStats {
  cpu?: number;
  memory?: number;
}

export interface TasksResponse {
  tasks: Task[];
  pagination: Pagination;
}

export interface Task {
  id?: string;
  execution_id: string;
  status: string;
  task_type?: string;
  task_hash?: string;
  chain_id?: string;
  block_number?: number;
  block_hash?: string;
  elapsed_ms?: number;
  gas_limit?: number;
  gas_used?: number;
  memory_limit?: number;
  memory_peak?: number;
  exit_code?: number;
  cached?: boolean;
  received_at?: string;
  started_at?: string;
  completed_at?: string;
  inputData?: Record<string, unknown>;
  outputData?: Record<string, unknown>;
  input_data?: string; // JSON string from database
  output_data?: string; // JSON string from database
  // New fields for sensitive data access control
  hasSensitiveData?: boolean;
  sensitiveDataRequiresAuth?: boolean;
}

export interface TaskArtifact {
  id: number;
  execution_id: string;
  artifact_type: string;
  hash: string | null;
  path: string | null;
  size_bytes: number | null;
  created_at: string;
}

export interface TaskStats {
  total: number;
  completed: number;
  failed: number;
  executing: number;
  avg_elapsed_ms: number;
  avg_gas_used: number;
}

export interface Pagination {
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface Invoice {
  id: string;
  timestamp: string;
  details: string | InvoiceDetails;
}

export interface InvoiceDetails {
  invoiceId?: string;
  taskId?: string;
  executionId?: string;
  chainId?: string;
  totalStepsComputed?: number;
  peakMemoryUsed?: number;
  operation?: string;
}

export interface Log {
  id?: number;
  timestamp: string;
  level?: string;
  type?: string;
  message?: string;
  raw?: string;
}

export interface LogStatus {
  source: string | null;
  lastLogAt: string | null;
}

export interface TasksParams {
  limit?: number;
  offset?: number;
  status?: string;
}

export interface LogsParams {
  limit?: number;
  offset?: number;
  level?: string | null;
  type?: string | null;
  search?: string | null;
}

export interface InvoicesParams {
  limit?: number;
  offset?: number;
}

export default {
  // Status
  async getStatus(): Promise<StatusResponse> {
    const { data } = await api.get<StatusResponse>('/status');
    return data;
  },

  async getStats(): Promise<ContainerStats> {
    const { data } = await api.get<ContainerStats>('/status/stats');
    return data;
  },

  // Tasks
  async getTasks(params: TasksParams = {}): Promise<TasksResponse> {
    const { data } = await api.get<TasksResponse>('/tasks', { params });
    return data;
  },

  async getTask(executionId: string): Promise<Task> {
    const { data } = await api.get<Task>(`/tasks/${executionId}`);
    return data;
  },

  async getTaskStats(): Promise<TaskStats> {
    const { data } = await api.get<TaskStats>('/tasks/stats/summary');
    return data;
  },

  async getTaskArtifacts(executionId: string): Promise<{ artifacts: TaskArtifact[] }> {
    const { data } = await api.get<{ artifacts: TaskArtifact[] }>(`/tasks/${executionId}/artifacts`);
    return data;
  },

  // Invoices
  async getInvoices(params: InvoicesParams = {}): Promise<{ invoices: Invoice[] }> {
    const { data } = await api.get<{ invoices: Invoice[] }>('/invoices', { params });
    return data;
  },

  async getInvoiceCount(): Promise<{ count: number }> {
    const { data } = await api.get<{ count: number }>('/invoices/count');
    return data;
  },

  // Logs
  async getLogs(params: LogsParams = {}): Promise<{ logs: Log[] }> {
    const { data } = await api.get<{ logs: Log[] }>('/logs', { params });
    return data;
  },

  async getLogStatus(): Promise<LogStatus> {
    const { data } = await api.get<LogStatus>('/logs/status');
    return data;
  }
};

// Federation API types
export interface FederationSettings {
  enabled: boolean;
  nodeId?: string | null;
  privacyLevel: string;
  shareTasks: boolean;
  shareStats: boolean;
  natsServers: string[];
  tlsEnabled: boolean;
  locationEnabled: boolean;
  locationLabel?: string | null;
  locationLat?: number | null;
  locationLon?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface FederationStatus {
  enabled: boolean;
  connected: boolean;
  healthy: boolean;
  status: string;
  stats: {
    messagesSent: number;
    messagesReceived: number;
    errors: number;
    reconnections: number;
    subscriptions?: number;
    circuitOpen?: boolean;
  };
  nodeId?: string;
}

export interface FederationMessage {
  id: number;
  message_type: string;
  sender_node_id: string;
  received_at: string;
  data: Record<string, unknown>;
  created_at: string;
}

export interface FederationPeer {
  node_id: string;
  first_seen: string;
  last_seen: string;
  is_blocked: boolean;
}

export interface FederationStatsResponse {
  timeSeriesStats: unknown[];
  aggregatedStats: unknown[];
  period: string;
}

export interface AggregatedNetworkStats {
  activeNodes: number;
  totalNodes: number;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  cachedTasks: number;
  tasksLast24h: number;
  totalInvoices: number;
  invoicesLast24h: number;
  successRate: number;
  cacheHitRate: number;
  executionTimeDistribution?: Record<string, number>;
  gasUsageDistribution?: Record<string, number>;
  stepsComputedDistribution?: Record<string, number>;
  memoryUsedDistribution?: Record<string, number>;
  chainDistribution?: Record<string, number>;
  taskTypeDistribution?: Record<string, number>;
  continentDistribution?: Record<string, number>;
  locationDistribution?: Record<string, number>;
  lastUpdated: string | null;
  status: string;
}

export interface PrivacyReport {
  privacyGuarantees: Record<string, string>;
  privacyLevel: string;
  dataSharing: {
    tasks: boolean;
    stats: boolean;
  };
  transparency: {
    messagesSent: number;
    messagesReceived: number;
    knownPeers: number;
  };
  privacyScore: number;
  recommendation: string;
}

// Federation API
export const federationAPI = {
  // Settings
  async getSettings(): Promise<FederationSettings> {
    const { data } = await api.get<FederationSettings>('/federation/settings');
    return data;
  },

  async updateSettings(settings: Partial<FederationSettings>): Promise<{ success: boolean; message: string }> {
    const { data } = await api.put<{ success: boolean; message: string }>('/federation/settings', settings);
    return data;
  },

  async lookupLocation(query: string): Promise<{ lat: number; lon: number; label: string }> {
    const { data } = await api.get<{ lat: number; lon: number; label: string }>('/federation/location-lookup', {
      params: { query }
    });
    return data;
  },

  async enable(): Promise<{ success: boolean; message: string; connected: boolean }> {
    const { data } = await api.post<{ success: boolean; message: string; connected: boolean }>('/federation/enable');
    return data;
  },

  async disable(): Promise<{ success: boolean; message: string }> {
    const { data } = await api.post<{ success: boolean; message: string }>('/federation/disable');
    return data;
  },

  // Status
  async getStatus(): Promise<FederationStatus> {
    const { data } = await api.get<FederationStatus>('/federation/status');
    return data;
  },

  // Messages
  async getMessages(limit = 100, offset = 0, type: string | null = null): Promise<{ messages: FederationMessage[]; pagination: Pagination }> {
    const params: Record<string, number | string> = { limit, offset };
    if (type) params.type = type;
    const { data } = await api.get<{ messages: FederationMessage[]; pagination: Pagination }>('/federation/messages', { params });
    return data;
  },

  // Peers
  async getPeers(): Promise<{ peers: FederationPeer[]; count: number }> {
    const { data } = await api.get<{ peers: FederationPeer[]; count: number }>('/federation/peers');
    return data;
  },

  async blockPeer(nodeId: string): Promise<{ success: boolean; message: string }> {
    const { data } = await api.post<{ success: boolean; message: string }>(`/federation/peers/${nodeId}/block`);
    return data;
  },

  // Statistics
  async getStats(hours = 24): Promise<FederationStatsResponse> {
    const { data } = await api.get<FederationStatsResponse>('/federation/stats', { params: { hours } });
    return data;
  },

  // Network-wide aggregated statistics
  async getNetworkStats(): Promise<AggregatedNetworkStats> {
    const { data } = await api.get<AggregatedNetworkStats>('/federation/network-stats');
    return data;
  },

  // Privacy
  async getPrivacyReport(): Promise<PrivacyReport> {
    const { data } = await api.get<PrivacyReport>('/federation/privacy');
    return data;
  }
};
