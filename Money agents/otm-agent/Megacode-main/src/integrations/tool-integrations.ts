/**
 * Tool Integrations for OverCoat Ecosystem.
 * 
 * This module provides integration interfaces for various tools in the ecosystem.
 */

// ============================================================================
// Tool Integration Interfaces
// ============================================================================

/** Base interface for all tool integrations. */
export interface ToolIntegration {
  /** Unique identifier for this integration. */
  id: string;
  /** Display name. */
  name: string;
  /** Tool version. */
  version: string;
  /** Whether the integration is enabled. */
  enabled: boolean;
  /** Configuration for this integration. */
  config: Record<string, unknown>;
  /** Health check for the integration. */
  healthCheck(): Promise<HealthCheckResult>;
  /** Initialize the integration. */
  initialize(): Promise<void>;
  /** Clean up resources. */
  cleanup(): Promise<void>;
}

/** Result of a health check. */
export interface HealthCheckResult {
  /** Whether the integration is healthy. */
  healthy: boolean;
  /** Optional message describing the health status. */
  message?: string;
  /** Optional timestamp of the check. */
  timestamp?: number;
  /** Optional metrics or details. */
  details?: Record<string, unknown>;
}

// ============================================================================
// Authelia Integration (Authentication/Authorization)
// ============================================================================

/** Configuration for Authelia integration. */
export interface AutheliaConfig {
  /** Authelia server URL. */
  serverUrl: string;
  /** Authentication endpoint. */
  authEndpoint: string;
  /** Authorization endpoint. */
  authzEndpoint: string;
  /** Session validation endpoint. */
  sessionEndpoint: string;
  /** Default redirect URL after authentication. */
  redirectUrl: string;
  /** Whether to verify TLS certificates. */
  verifyTls: boolean;
  /** Timeout for requests in milliseconds. */
  timeoutMs: number;
}

/** User authentication information. */
export interface AuthUser {
  /** User identifier. */
  id: string;
  /** Username. */
  username: string;
  /** Email address. */
  email?: string;
  /** Display name. */
  displayName?: string;
  /** Groups the user belongs to. */
  groups: string[];
  /** Authentication method used. */
  authMethod: string;
  /** Session expiration timestamp. */
  expiresAt?: number;
}

/** Authorization request. */
export interface AuthzRequest {
  /** User identifier. */
  userId: string;
  /** Resource being accessed. */
  resource: string;
  /** Action being performed. */
  action: string;
  /** Optional resource attributes. */
  attributes?: Record<string, unknown>;
}

/** Authorization result. */
export interface AuthzResult {
  /** Whether access is allowed. */
  allowed: boolean;
  /** Optional reason for denial. */
  reason?: string;
  /** Optional conditions for access. */
  conditions?: Record<string, unknown>;
}

/** Authelia integration implementation. */
export class AutheliaIntegration implements ToolIntegration {
  id = "authelia";
  name = "Authelia";
  version = "1.0.0";
  enabled = true;
  config: Record<string, unknown>;

  private initialized = false;

  constructor(config: Partial<AutheliaConfig> = {}) {
    this.config = {
      serverUrl: config.serverUrl || "http://localhost:9091",
      authEndpoint: config.authEndpoint || "/api/auth",
      authzEndpoint: config.authzEndpoint || "/api/authz",
      sessionEndpoint: config.sessionEndpoint || "/api/session",
      redirectUrl: config.redirectUrl || "/",
      verifyTls: config.verifyTls ?? true,
      timeoutMs: config.timeoutMs || 10000,
    } as Record<string, unknown>;
  }

  async healthCheck(): Promise<HealthCheckResult> {
    try {
      const timeoutMs = this.config.timeoutMs as number;
      const response = await fetch(`${this.config.serverUrl}/api/health`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
      });

      const healthy = response.ok;
      return {
        healthy,
        message: healthy ? "Authelia is healthy" : `Authelia health check failed: ${response.status}`,
        timestamp: Date.now(),
        details: { status: response.status },
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Authelia health check error: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: Date.now(),
      };
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const health = await this.healthCheck();
    if (!health.healthy) {
      throw new Error(`Cannot initialize Authelia integration: ${health.message}`);
    }

    this.initialized = true;
  }

  async cleanup(): Promise<void> {
    this.initialized = false;
  }

  /** Authenticate a user. */
  async authenticate(username: string, password: string): Promise<AuthUser> {
    const timeoutMs = this.config.timeoutMs as number;
    const response = await fetch(`${this.config.serverUrl}${this.config.authEndpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Authentication failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return {
      id: data.id,
      username: data.username,
      email: data.email,
      displayName: data.display_name,
      groups: data.groups || [],
      authMethod: data.auth_method,
      expiresAt: data.expires_at,
    };
  }

  /** Authorize an action. */
  async authorize(request: AuthzRequest): Promise<AuthzResult> {
    const timeoutMs = this.config.timeoutMs as number;
    const response = await fetch(`${this.config.serverUrl}${this.config.authzEndpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      return {
        allowed: false,
        reason: `Authorization request failed: ${response.status} ${response.statusText}`,
      };
    }

    const data = await response.json();
    return {
      allowed: data.allowed,
      reason: data.reason,
      conditions: data.conditions,
    };
  }

  /** Validate a session. */
  async validateSession(sessionId: string): Promise<AuthUser | null> {
    const timeoutMs = this.config.timeoutMs as number;
    const response = await fetch(`${this.config.serverUrl}${this.config.sessionEndpoint}/${sessionId}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return {
      id: data.id,
      username: data.username,
      email: data.email,
      displayName: data.display_name,
      groups: data.groups || [],
      authMethod: data.auth_method,
      expiresAt: data.expires_at,
    };
  }
}

// ============================================================================
// memU Integration (AI Agent Memory Management)
// ============================================================================

/** Configuration for memU integration. */
export interface MemUConfig {
  /** memU server URL. */
  serverUrl: string;
  /** API endpoint for memory operations. */
  memoryEndpoint: string;
  /** API endpoint for retrieval operations. */
  retrieveEndpoint: string;
  /** Default user ID for memory operations. */
  defaultUserId: string;
  /** Timeout for requests in milliseconds. */
  timeoutMs: number;
}

/** Memory item for storage. */
export interface MemoryItem {
  /** Unique identifier for the memory. */
  id: string;
  /** User ID associated with this memory. */
  userId: string;
  /** Content of the memory. */
  content: string;
  /** Optional metadata. */
  metadata?: Record<string, unknown>;
  /** Optional tags for categorization. */
  tags?: string[];
  /** Creation timestamp. */
  createdAt: number;
  /** Last update timestamp. */
  updatedAt: number;
  /** Optional expiration timestamp. */
  expiresAt?: number;
}

/** Memory retrieval request. */
export interface MemoryRetrievalRequest {
  /** User ID to retrieve memories for. */
  userId: string;
  /** Query for semantic search. */
  query?: string;
  /** Optional tags to filter by. */
  tags?: string[];
  /** Maximum number of memories to return. */
  limit?: number;
  /** Optional time range filter. */
  timeRange?: {
    start: number;
    end: number;
  };
}

/** Memory retrieval result. */
export interface MemoryRetrievalResult {
  /** Retrieved memories. */
  memories: MemoryItem[];
  /** Total number of memories matching the query. */
  total: number;
  /** Query execution time in milliseconds. */
  executionTime: number;
}

/** memU integration implementation. */
export class MemUIntegration implements ToolIntegration {
  id = "memu";
  name = "memU";
  version = "1.0.0";
  enabled = true;
  config: Record<string, unknown>;

  private initialized = false;

  constructor(config: Partial<MemUConfig> = {}) {
    this.config = {
      serverUrl: config.serverUrl || "http://localhost:8080",
      memoryEndpoint: config.memoryEndpoint || "/api/memory",
      retrieveEndpoint: config.retrieveEndpoint || "/api/retrieve",
      defaultUserId: config.defaultUserId || "default",
      timeoutMs: config.timeoutMs || 10000,
    } as Record<string, unknown>;
  }

  async healthCheck(): Promise<HealthCheckResult> {
    try {
      const timeoutMs = this.config.timeoutMs as number;
      const response = await fetch(`${this.config.serverUrl}/api/health`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
      });

      const healthy = response.ok;
      return {
        healthy,
        message: healthy ? "memU is healthy" : `memU health check failed: ${response.status}`,
        timestamp: Date.now(),
        details: { status: response.status },
      };
    } catch (error) {
      return {
        healthy: false,
        message: `memU health check error: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: Date.now(),
      };
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const health = await this.healthCheck();
    if (!health.healthy) {
      throw new Error(`Cannot initialize memU integration: ${health.message}`);
    }

    this.initialized = true;
  }

  async cleanup(): Promise<void> {
    this.initialized = false;
  }

  /** Store a memory. */
  async storeMemory(item: Omit<MemoryItem, "id" | "createdAt" | "updatedAt">): Promise<MemoryItem> {
    const timeoutMs = this.config.timeoutMs as number;
    const response = await fetch(`${this.config.serverUrl}${this.config.memoryEndpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...item,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Failed to store memory: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  /** Retrieve memories. */
  async retrieveMemories(request: MemoryRetrievalRequest): Promise<MemoryRetrievalResult> {
    const timeoutMs = this.config.timeoutMs as number;
    const response = await fetch(`${this.config.serverUrl}${this.config.retrieveEndpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Failed to retrieve memories: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  /** Update a memory. */
  async updateMemory(id: string, updates: Partial<MemoryItem>): Promise<MemoryItem> {
    const timeoutMs = this.config.timeoutMs as number;
    const response = await fetch(`${this.config.serverUrl}${this.config.memoryEndpoint}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...updates,
        updatedAt: Date.now(),
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Failed to update memory: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  /** Delete a memory. */
  async deleteMemory(id: string): Promise<boolean> {
    const timeoutMs = this.config.timeoutMs as number;
    const response = await fetch(`${this.config.serverUrl}${this.config.memoryEndpoint}/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });

    return response.ok;
  }
}

// ============================================================================
// OpenMeter Integration (Billing and Metering)
// ============================================================================

/** Configuration for OpenMeter integration. */
export interface OpenMeterConfig {
  /** OpenMeter server URL. */
  serverUrl: string;
  /** API endpoint for metering. */
  meterEndpoint: string;
  /** API endpoint for billing. */
  billingEndpoint: string;
  /** Default namespace for metering. */
  defaultNamespace: string;
  /** Timeout for requests in milliseconds. */
  timeoutMs: number;
}

/** Metering event. */
export interface MeterEvent {
  /** Event type/name. */
  event: string;
  /** Event timestamp. */
  timestamp: number;
  /** Event properties. */
  properties: Record<string, unknown>;
  /** Optional customer ID. */
  customerId?: string;
  /** Optional namespace. */
  namespace?: string;
}

/** Billing information. */
export interface BillingInfo {
  /** Customer ID. */
  customerId: string;
  /** Current usage. */
  usage: Record<string, number>;
  /** Current balance. */
  balance: number;
  /** Currency. */
  currency: string;
  /** Billing period. */
  period: {
    start: number;
    end: number;
  };
}

/** OpenMeter integration implementation. */
export class OpenMeterIntegration implements ToolIntegration {
  id = "openmeter";
  name = "OpenMeter";
  version = "1.0.0";
  enabled = true;
  config: Record<string, unknown>;

  private initialized = false;

  constructor(config: Partial<OpenMeterConfig> = {}) {
    this.config = {
      serverUrl: config.serverUrl || "http://localhost:8888",
      meterEndpoint: config.meterEndpoint || "/api/meter",
      billingEndpoint: config.billingEndpoint || "/api/billing",
      defaultNamespace: config.defaultNamespace || "default",
      timeoutMs: config.timeoutMs || 10000,
    } as Record<string, unknown>;
  }

  async healthCheck(): Promise<HealthCheckResult> {
    try {
      const timeoutMs = this.config.timeoutMs as number;
      const response = await fetch(`${this.config.serverUrl}/api/health`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
      });

      const healthy = response.ok;
      return {
        healthy,
        message: healthy ? "OpenMeter is healthy" : `OpenMeter health check failed: ${response.status}`,
        timestamp: Date.now(),
        details: { status: response.status },
      };
    } catch (error) {
      return {
        healthy: false,
        message: `OpenMeter health check error: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: Date.now(),
      };
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const health = await this.healthCheck();
    if (!health.healthy) {
      throw new Error(`Cannot initialize OpenMeter integration: ${health.message}`);
    }

    this.initialized = true;
  }

  async cleanup(): Promise<void> {
    this.initialized = false;
  }

  /** Record a metering event. */
  async recordEvent(event: MeterEvent): Promise<void> {
    const timeoutMs = this.config.timeoutMs as number;
    const response = await fetch(`${this.config.serverUrl}${this.config.meterEndpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...event,
        namespace: event.namespace || this.config.defaultNamespace,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Failed to record event: ${response.status} ${response.statusText}`);
    }
  }

  /** Get billing information for a customer. */
  async getBillingInfo(customerId: string): Promise<BillingInfo> {
    const timeoutMs = this.config.timeoutMs as number;
    const response = await fetch(`${this.config.serverUrl}${this.config.billingEndpoint}/${customerId}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Failed to get billing info: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  /** Get usage statistics. */
  async getUsageStats(namespace?: string): Promise<Record<string, number>> {
    const ns = namespace || (this.config.defaultNamespace as string);
    const timeoutMs = this.config.timeoutMs as number;
    const response = await fetch(`${this.config.serverUrl}${this.config.meterEndpoint}/stats/${ns}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Failed to get usage stats: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }
}

// ============================================================================
// Voicebox Integration (Voice Synthesis)
// ============================================================================

/** Configuration for Voicebox integration. */
export interface VoiceboxConfig {
  /** Voicebox server URL. */
  serverUrl: string;
  /** Timeout for requests in milliseconds. */
  timeoutMs: number;
  /** Default language code (e.g., 'en', 'es', 'fr'). */
  defaultLanguage: string;
}

/** Voice profile information. */
export interface VoiceProfile {
  id: string;
  name: string;
  description?: string;
  language: string;
  avatarPath?: string;
  createdAt: string;
  updatedAt: string;
}

/** Generation request. */
export interface GenerationRequest {
  profileId: string;
  text: string;
  language: string;
  seed?: number;
  modelSize?: '1.7B' | '0.6B';
}

/** Generation response. */
export interface GenerationResponse {
  id: string;
  profileId: string;
  text: string;
  language: string;
  audioPath: string;
  duration: number;
  seed?: number;
  createdAt: string;
}

/** Transcription response. */
export interface TranscriptionResponse {
  text: string;
  duration: number;
}

/** Model status. */
export interface ModelStatus {
  modelName: string;
  displayName: string;
  downloaded: boolean;
  downloading: boolean;
  sizeMb?: number;
  loaded: boolean;
}

/** Story information. */
export interface Story {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
}

/** Voicebox integration implementation. */
export class VoiceboxIntegration implements ToolIntegration {
  id = "voicebox";
  name = "Voicebox";
  version = "1.0.0";
  enabled = true;
  config: Record<string, unknown>;

  private initialized = false;

  constructor(config: Partial<VoiceboxConfig> = {}) {
    this.config = {
      serverUrl: config.serverUrl || "http://localhost:8000",
      timeoutMs: config.timeoutMs || 30000,
      defaultLanguage: config.defaultLanguage || "en",
    } as Record<string, unknown>;
  }

  async healthCheck(): Promise<HealthCheckResult> {
    try {
      const timeoutMs = this.config.timeoutMs as number;
      const response = await fetch(`${this.config.serverUrl}/health`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
      });

      const healthy = response.ok;
      let message = healthy ? "Voicebox is healthy" : `Voicebox health check failed: ${response.status}`;
      let details: Record<string, unknown> = { status: response.status };

      if (healthy) {
        try {
          const data = await response.json();
          details = { ...details, ...data };
          if (data.status) message = `Voicebox status: ${data.status}`;
        } catch {
          // ignore JSON parsing errors
        }
      }

      return {
        healthy,
        message,
        timestamp: Date.now(),
        details,
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Voicebox health check error: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: Date.now(),
      };
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const health = await this.healthCheck();
    if (!health.healthy) {
      throw new Error(`Cannot initialize Voicebox integration: ${health.message}`);
    }

    this.initialized = true;
  }

  async cleanup(): Promise<void> {
    this.initialized = false;
  }

  /** List all voice profiles. */
  async listProfiles(): Promise<VoiceProfile[]> {
    const timeoutMs = this.config.timeoutMs as number;
    const response = await fetch(`${this.config.serverUrl}/profiles`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Failed to list profiles: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  /** Get a specific profile. */
  async getProfile(profileId: string): Promise<VoiceProfile> {
    const timeoutMs = this.config.timeoutMs as number;
    const response = await fetch(`${this.config.serverUrl}/profiles/${profileId}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Failed to get profile: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  /** Create a new voice profile. */
  async createProfile(name: string, language: string, description?: string): Promise<VoiceProfile> {
    const timeoutMs = this.config.timeoutMs as number;
    const response = await fetch(`${this.config.serverUrl}/profiles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, language, description }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Failed to create profile: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  /** Update a profile. */
  async updateProfile(profileId: string, updates: Partial<VoiceProfile>): Promise<VoiceProfile> {
    const timeoutMs = this.config.timeoutMs as number;
    const response = await fetch(`${this.config.serverUrl}/profiles/${profileId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Failed to update profile: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  /** Delete a profile. */
  async deleteProfile(profileId: string): Promise<void> {
    const timeoutMs = this.config.timeoutMs as number;
    const response = await fetch(`${this.config.serverUrl}/profiles/${profileId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Failed to delete profile: ${response.status} ${response.statusText}`);
    }
  }

  /** Generate speech from text. */
  async generateSpeech(request: GenerationRequest): Promise<GenerationResponse> {
    const timeoutMs = this.config.timeoutMs as number;
    const response = await fetch(`${this.config.serverUrl}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Failed to generate speech: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  /** Transcribe audio from a file. */
  async transcribeAudio(file: File, language?: string): Promise<TranscriptionResponse> {
    const formData = new FormData();
    formData.append("file", file);
    if (language) {
      formData.append("language", language);
    }

    const timeoutMs = this.config.timeoutMs as number;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${this.config.serverUrl}/transcribe`, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to transcribe audio: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  /** Get model status. */
  async getModelStatus(): Promise<ModelStatus[]> {
    const timeoutMs = this.config.timeoutMs as number;
    const response = await fetch(`${this.config.serverUrl}/models/status`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Failed to get model status: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.models || data;
  }

  /** Trigger model download. */
  async triggerModelDownload(modelName: string): Promise<{ message: string }> {
    const timeoutMs = this.config.timeoutMs as number;
    const response = await fetch(`${this.config.serverUrl}/models/download`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model_name: modelName }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Failed to trigger model download: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  /** List stories. */
  async listStories(): Promise<Story[]> {
    const timeoutMs = this.config.timeoutMs as number;
    const response = await fetch(`${this.config.serverUrl}/stories`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Failed to list stories: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  /** Get a story with its items. */
  async getStory(storyId: string): Promise<Story & { items: unknown[] }> {
    const timeoutMs = this.config.timeoutMs as number;
    const response = await fetch(`${this.config.serverUrl}/stories/${storyId}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Failed to get story: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  /** Create a new story. */
  async createStory(name: string, description?: string): Promise<Story> {
    const timeoutMs = this.config.timeoutMs as number;
    const response = await fetch(`${this.config.serverUrl}/stories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Failed to create story: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  /** Delete a story. */
  async deleteStory(storyId: string): Promise<void> {
    const timeoutMs = this.config.timeoutMs as number;
    const response = await fetch(`${this.config.serverUrl}/stories/${storyId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Failed to delete story: ${response.status} ${response.statusText}`);
    }
  }
}

// ============================================================================
// ZVec Integration (Vector Embeddings)
// ============================================================================

/** Configuration for ZVec integration. */
export interface ZVecConfig {
  /** ZVec server URL. */
  serverUrl: string;
  /** Timeout for requests in milliseconds. */
  timeoutMs: number;
  /** Default embedding dimension. */
  defaultDimension: number;
}

/** Vector embedding result. */
export interface EmbeddingResult {
  /** The original text. */
  text: string;
  /** Embedding vector. */
  embedding: number[];
  /** Dimension of the embedding. */
  dimension: number;
}

/** Search result. */
export interface SearchResult {
  /** Document ID. */
  id: string;
  /** Similarity score. */
  score: number;
  /** Optional metadata. */
  metadata?: Record<string, unknown>;
}

/** ZVec integration implementation. */
export class ZVecIntegration implements ToolIntegration {
  id = "zvec";
  name = "ZVec";
  version = "1.0.0";
  enabled = true;
  config: Record<string, unknown>;

  private initialized = false;

  constructor(config: Partial<ZVecConfig> = {}) {
    this.config = {
      serverUrl: config.serverUrl || "http://localhost:8001",
      timeoutMs: config.timeoutMs || 10000,
      defaultDimension: config.defaultDimension || 768,
    } as Record<string, unknown>;
  }

  async healthCheck(): Promise<HealthCheckResult> {
    try {
      const timeoutMs = this.config.timeoutMs as number;
      const response = await fetch(`${this.config.serverUrl}/health`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
      });

      const healthy = response.ok;
      return {
        healthy,
        message: healthy ? "ZVec is healthy" : `ZVec health check failed: ${response.status}`,
        timestamp: Date.now(),
        details: { status: response.status },
      };
    } catch (error) {
      return {
        healthy: false,
        message: `ZVec health check error: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: Date.now(),
      };
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const health = await this.healthCheck();
    if (!health.healthy) {
      throw new Error(`Cannot initialize ZVec integration: ${health.message}`);
    }

    this.initialized = true;
  }

  async cleanup(): Promise<void> {
    this.initialized = false;
  }

  /** Embed texts into vectors. */
  async embed(texts: string[]): Promise<EmbeddingResult[]> {
    const timeoutMs = this.config.timeoutMs as number;
    const response = await fetch(`${this.config.serverUrl}/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Failed to embed texts: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  /** Search for similar vectors. */
  async search(vector: number[], topK: number = 10): Promise<SearchResult[]> {
    const timeoutMs = this.config.timeoutMs as number;
    const response = await fetch(`${this.config.serverUrl}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vector, topK }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Failed to search vectors: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }
}

// ============================================================================
// Yumcut Integration (Image Generation)
// ============================================================================

/** Configuration for Yumcut integration. */
export interface YumcutConfig {
  /** Yumcut server URL. */
  serverUrl: string;
  /** Timeout for requests in milliseconds. */
  timeoutMs: number;
  /** Default model for image generation. */
  defaultModel: string;
}

/** Image generation result. */
export interface ImageGenerationResult {
  /** Generated image URL or local path. */
  imageUrl: string;
  /** Seed used for generation. */
  seed: number;
  /** Generation parameters. */
  parameters: Record<string, unknown>;
  /** Generation timestamp. */
  generatedAt: number;
}

/** Model information. */
export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
  resolution: string;
  supports: string[];
}

/** Yumcut integration implementation. */
export class YumcutIntegration implements ToolIntegration {
  id = "yumcut";
  name = "Yumcut";
  version = "1.0.0";
  enabled = true;
  config: Record<string, unknown>;

  private initialized = false;

  constructor(config: Partial<YumcutConfig> = {}) {
    this.config = {
      serverUrl: config.serverUrl || "http://localhost:8002",
      timeoutMs: config.timeoutMs || 30000,
      defaultModel: config.defaultModel || "stable-diffusion-v2",
    } as Record<string, unknown>;
  }

  async healthCheck(): Promise<HealthCheckResult> {
    try {
      const timeoutMs = this.config.timeoutMs as number;
      const response = await fetch(`${this.config.serverUrl}/health`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
      });

      const healthy = response.ok;
      return {
        healthy,
        message: healthy ? "Yumcut is healthy" : `Yumcut health check failed: ${response.status}`,
        timestamp: Date.now(),
        details: { status: response.status },
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Yumcut health check error: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: Date.now(),
      };
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const health = await this.healthCheck();
    if (!health.healthy) {
      throw new Error(`Cannot initialize Yumcut integration: ${health.message}`);
    }

    this.initialized = true;
  }

  async cleanup(): Promise<void> {
    this.initialized = false;
  }

  /** Generate an image from a prompt. */
  async generateImage(prompt: string, options?: Record<string, unknown>): Promise<ImageGenerationResult> {
    const timeoutMs = this.config.timeoutMs as number;
    const response = await fetch(`${this.config.serverUrl}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        model: options?.model || this.config.defaultModel,
        ...options,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Failed to generate image: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  /** List available models. */
  async listModels(): Promise<ModelInfo[]> {
    const timeoutMs = this.config.timeoutMs as number;
    const response = await fetch(`${this.config.serverUrl}/models`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Failed to list models: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  /** Get model details. */
  async getModel(modelId: string): Promise<ModelInfo> {
    const timeoutMs = this.config.timeoutMs as number;
    const response = await fetch(`${this.config.serverUrl}/models/${modelId}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Failed to get model: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }
}

// ============================================================================
// Shannon Integration (Vector DB/Search)
// ============================================================================

/** Configuration for Shannon integration. */
export interface ShannonConfig {
  /** Shannon server URL. */
  serverUrl: string;
  /** Timeout for requests in milliseconds. */
  timeoutMs: number;
  /** Default collection name. */
  defaultCollection: string;
}

/** Document to index. */
export interface Document {
  /** Document ID. */
  id: string;
  /** Document content. */
  content: string;
  /** Embedding vector (optional, will be generated if not provided). */
  embedding?: number[];
  /** Metadata. */
  metadata?: Record<string, unknown>;
}

/** Search query. */
export interface SearchQuery {
  /** Query text. */
  query: string;
  /** Optional filter. */
  filter?: Record<string, unknown>;
  /** Maximum results. */
  topK?: number;
  /** Collection to search in. */
  collection?: string;
}

/** Search result. */
export interface DocumentSearchResult {
  /** Document ID. */
  id: string;
  /** Relevance score. */
  score: number;
  /** Document content snippet. */
  snippet: string;
  /** Full document. */
  document: Document;
}

/** Shannon integration implementation. */
export class ShannonIntegration implements ToolIntegration {
  id = "shannon";
  name = "Shannon";
  version = "1.0.0";
  enabled = true;
  config: Record<string, unknown>;

  private initialized = false;

  constructor(config: Partial<ShannonConfig> = {}) {
    this.config = {
      serverUrl: config.serverUrl || "http://localhost:8003",
      timeoutMs: config.timeoutMs || 10000,
      defaultCollection: config.defaultCollection || "default",
    } as Record<string, unknown>;
  }

  async healthCheck(): Promise<HealthCheckResult> {
    try {
      const timeoutMs = this.config.timeoutMs as number;
      const response = await fetch(`${this.config.serverUrl}/health`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
      });

      const healthy = response.ok;
      return {
        healthy,
        message: healthy ? "Shannon is healthy" : `Shannon health check failed: ${response.status}`,
        timestamp: Date.now(),
        details: { status: response.status },
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Shannon health check error: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: Date.now(),
      };
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const health = await this.healthCheck();
    if (!health.healthy) {
      throw new Error(`Cannot initialize Shannon integration: ${health.message}`);
    }

    this.initialized = true;
  }

  async cleanup(): Promise<void> {
    this.initialized = false;
  }

  /** Index a document. */
  async index(document: Document): Promise<{ id: string; success: boolean }> {
    const timeoutMs = this.config.timeoutMs as number;
    const response = await fetch(`${this.config.serverUrl}/index`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(document),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Failed to index document: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  /** Search for documents. */
  async search(query: SearchQuery): Promise<DocumentSearchResult[]> {
    const timeoutMs = this.config.timeoutMs as number;
    const response = await fetch(`${this.config.serverUrl}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(query),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Failed to search documents: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  /** Delete a document. */
  async deleteDocument(documentId: string): Promise<{ success: boolean }> {
    const timeoutMs = this.config.timeoutMs as number;
    const response = await fetch(`${this.config.serverUrl}/documents/${documentId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Failed to delete document: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  /** List collections. */
  async listCollections(): Promise<string[]> {
    const timeoutMs = this.config.timeoutMs as number;
    const response = await fetch(`${this.config.serverUrl}/collections`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Failed to list collections: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }
}

// ============================================================================
// Integration Manager
// ============================================================================

/** Manages all tool integrations. */
export class IntegrationManager {
  private integrations: Map<string, ToolIntegration> = new Map();

  /** Register a new integration. */
  register(integration: ToolIntegration): void {
    this.integrations.set(integration.id, integration);
  }

  /** Get an integration by ID. */
  get(id: string): ToolIntegration | null {
    return this.integrations.get(id) ?? null;
  }

  /** Remove an integration. */
  remove(id: string): boolean {
    return this.integrations.delete(id);
  }

  /** List all registered integrations. */
  list(): ToolIntegration[] {
    return Array.from(this.integrations.values());
  }

  /** Get integrations by status. */
  getByStatus(enabled: boolean): ToolIntegration[] {
    return this.list().filter((i) => i.enabled === enabled);
  }

  /** Initialize all enabled integrations. */
  async initializeAll(): Promise<void> {
    const enabled = this.getByStatus(true);
    for (const integration of enabled) {
      try {
        await integration.initialize();
      } catch (error) {
        console.error(`Failed to initialize integration ${integration.id}:`, error);
      }
    }
  }

  /** Clean up all integrations. */
  async cleanupAll(): Promise<void> {
    for (const integration of this.list()) {
      try {
        await integration.cleanup();
      } catch (error) {
        console.error(`Failed to clean up integration ${integration.id}:`, error);
      }
    }
  }

  /** Health check for all integrations. */
  async healthCheckAll(): Promise<Record<string, HealthCheckResult>> {
    const results: Record<string, HealthCheckResult> = {};
    for (const integration of this.list()) {
      try {
        results[integration.id] = await integration.healthCheck();
      } catch (error) {
        results[integration.id] = {
          healthy: false,
          message: `Health check failed: ${error instanceof Error ? error.message : String(error)}`,
          timestamp: Date.now(),
        };
      }
    }
    return results;
  }
}