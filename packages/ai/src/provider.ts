import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createAzure } from "@ai-sdk/azure";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import { loadAIConfig, type AIConfig } from "./config.js";

let cachedModel: LanguageModel | null = null;
let cachedConfig: AIConfig | null = null;

/**
 * Creates a language model instance based on the configured provider.
 * This is the single entry point for all LLM access in Onera Operator.
 *
 * Provider is determined by the AI_PROVIDER environment variable.
 * Never import provider SDKs directly — always use this function.
 */
export function getModel(configOverride?: Partial<AIConfig>): LanguageModel {
  const config = { ...loadAIConfig(), ...configOverride };

  // Return cached model if config hasn't changed
  if (
    cachedModel &&
    cachedConfig &&
    cachedConfig.provider === config.provider &&
    cachedConfig.model === config.model &&
    cachedConfig.apiKey === config.apiKey
  ) {
    return cachedModel;
  }

  cachedConfig = config;
  cachedModel = createModelForProvider(config);
  return cachedModel;
}

function createModelForProvider(config: AIConfig): LanguageModel {
  switch (config.provider) {
    case "openai": {
      const openai = createOpenAI({
        apiKey: config.apiKey,
        ...(config.baseURL ? { baseURL: config.baseURL } : {}),
      });
      return openai(config.model);
    }

    case "anthropic": {
      const anthropic = createAnthropic({
        apiKey: config.apiKey,
      });
      return anthropic(config.model);
    }

    case "azure": {
      const azureOptions: Record<string, unknown> = {
        apiKey: config.apiKey,
      };
      // Support either a full base URL or a resource name.
      // @ai-sdk/azure with baseURL resolves as: {baseURL}/{modelId}{path}
      // So baseURL must include /openai/deployments to work properly.
      // If the user gives us a root Azure URL, we append the path ourselves.
      if (config.baseURL) {
        let base = config.baseURL.replace(/\/+$/, ""); // strip trailing slashes
        if (!base.includes("/openai/deployments")) {
          base = `${base}/openai/deployments`;
        }
        azureOptions.baseURL = base;
      } else if (config.azureResourceName) {
        azureOptions.resourceName = config.azureResourceName;
      } else {
        throw new Error(
          "Either AI_BASE_URL or AI_AZURE_RESOURCE_NAME is required for Azure OpenAI provider"
        );
      }
      const azure = createAzure(azureOptions);
      return azure(config.azureDeploymentName || config.model);
    }

    case "openai-compatible": {
      if (!config.baseURL) {
        throw new Error(
          "AI_BASE_URL is required for openai-compatible provider"
        );
      }
      const compatible = createOpenAICompatible({
        name: "custom-provider",
        baseURL: config.baseURL,
        apiKey: config.apiKey || undefined,
      });
      return compatible.chatModel(config.model);
    }

    default:
      throw new Error(`Unsupported AI provider: ${config.provider}`);
  }
}

// ─── Per-Agent Model Routing ────────────────────────────────────
// Users never see which model runs. We pick the optimal model per agent
// to maximize margin while maintaining quality.
//
// Routing table (internal only):
//   planner  → Kimi K2.5     (structured output, cheap)
//   twitter  → Kimi K2.5     (short-form, doesn't need frontier)
//   outreach → default model  (quality matters for emails)
//   research → default model  (good reasoning needed)
//   engineer → default model  (best for code gen)
//   report   → Kimi K2.5     (structured summary, cheap)
//   chat     → default model  (user-facing, quality matters)
//   public   → Kimi K2.5     (high volume, low-value)
//
// The "default model" is whatever AI_PROVIDER/AI_MODEL is configured to.
// Cheap agents use the env-configured Azure Kimi K2.5 which is already the default.
// When you add Sonnet/GPT keys, override specific agents here.

const AGENT_MODEL_OVERRIDES: Record<string, Partial<AIConfig>> = {
  // Currently all agents use the default model (Kimi K2.5 via Azure).
  // When you add OpenAI/Anthropic keys, uncomment overrides:
  //
  // outreach: { provider: "anthropic", model: "claude-sonnet-4-20250514", apiKey: process.env.ANTHROPIC_API_KEY || "" },
  // research: { provider: "openai", model: "gpt-4o", apiKey: process.env.OPENAI_API_KEY || "" },
  // engineer: { provider: "openai", model: "gpt-4o", apiKey: process.env.OPENAI_API_KEY || "" },
  // chat:     { provider: "anthropic", model: "claude-sonnet-4-20250514", apiKey: process.env.ANTHROPIC_API_KEY || "" },
};

// Cache per agent to avoid re-creating models
const agentModelCache: Record<string, LanguageModel> = {};

/**
 * Get the optimal model for a specific agent.
 * Falls back to the default model if no override is configured.
 */
export function getModelForAgent(agentName: string): LanguageModel {
  if (agentModelCache[agentName]) {
    return agentModelCache[agentName];
  }

  const override = AGENT_MODEL_OVERRIDES[agentName];
  if (override && override.apiKey) {
    const model = getModel(override);
    agentModelCache[agentName] = model;
    return model;
  }

  // No override — use default model
  return getModel();
}

/**
 * Clears the cached model. Useful when config changes at runtime.
 */
export function resetModel(): void {
  cachedModel = null;
  cachedConfig = null;
  // Clear agent cache too
  for (const key of Object.keys(agentModelCache)) {
    delete agentModelCache[key];
  }
}
