import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createAzure } from "@ai-sdk/azure";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import { loadAIConfig, loadPremiumAIConfig, type AIConfig } from "./config.js";

let cachedModel: LanguageModel | null = null;
let cachedConfig: AIConfig | null = null;
let cachedPremiumModel: LanguageModel | null = null;
let cachedPremiumConfig: AIConfig | null = null;

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

/**
 * Returns the premium (frontier) model for quality-critical tasks.
 * Falls back to the default model if AI_PREMIUM_MODEL is not configured.
 */
export function getPremiumModel(): LanguageModel {
  const premiumConfig = loadPremiumAIConfig();
  if (!premiumConfig) return getModel();

  if (
    cachedPremiumModel &&
    cachedPremiumConfig &&
    cachedPremiumConfig.provider === premiumConfig.provider &&
    cachedPremiumConfig.model === premiumConfig.model &&
    cachedPremiumConfig.apiKey === premiumConfig.apiKey
  ) {
    return cachedPremiumModel;
  }

  cachedPremiumConfig = premiumConfig;
  cachedPremiumModel = createModelForProvider(premiumConfig);
  return cachedPremiumModel;
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
        // @ai-sdk/azure@3 defaults to /v1 paths. Azure OpenAI requires
        // deployment-based URLs: {base}/deployments/{model}/chat/completions
        useDeploymentBasedUrls: true,
        // Use the standard Azure API version
        apiVersion: "2025-03-01-preview",
      };
      // Support either a full base URL or a resource name.
      // In @ai-sdk/azure@3 with useDeploymentBasedUrls, the URL is built as:
      //   {baseURL}/deployments/{modelId}{path}?api-version=...
      // So baseURL should end at /openai (not /openai/deployments).
      if (config.baseURL) {
        let base = config.baseURL.replace(/\/+$/, ""); // strip trailing slashes
        // Remove /openai/deployments suffix if present (leftover from v1 config)
        base = base.replace(/\/openai\/deployments$/, "");
        // Ensure it ends with /openai
        if (!base.endsWith("/openai")) {
          base = `${base}/openai`;
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
      // In @ai-sdk/azure@3, azure(model) defaults to the Responses API (/responses).
      // Azure OpenAI doesn't support /responses for all models.
      // Use azure.chat(model) to force the Chat Completions API.
      return azure.chat(config.azureDeploymentName || config.model);
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
// Two-tier model strategy:
//
//   Premium (GPT-5.4)  — frontier intelligence for quality-critical work
//   Default (Kimi K2.5) — cost-efficient 1T param model for volume work
//
// Routing table:
//   Agent      │ Tier      │ Rationale
//   ───────────┼───────────┼──────────────────────────────────────
//   chat       │ premium   │ User-facing, quality = UX
//   outreach   │ premium   │ Email quality drives conversion
//   research   │ premium   │ Needs strong reasoning and synthesis
//   engineer   │ premium   │ Code gen needs frontier intelligence
//   ───────────┼───────────┼──────────────────────────────────────
//   planner    │ default   │ Structured output, task decomposition
//   twitter    │ default   │ Short-form, Kimi handles well
//   report     │ default   │ Structured summary, cost-efficient
//   public     │ default   │ High volume visitor Q&A
//
// Both models run on the same Azure resource (same API key).
// Configure AI_PREMIUM_MODEL=gpt-5.4 to activate the split.
// If AI_PREMIUM_MODEL is unset, all agents use the default model.

const PREMIUM_AGENTS = new Set([
  "chat",
  "outreach",
  "research",
  "engineer",
]);

// Cache per agent to avoid re-creating models
const agentModelCache: Record<string, LanguageModel> = {};

/**
 * Get the optimal model for a specific agent.
 *
 * Premium agents (chat, outreach, research, engineer) get GPT-5.4.
 * All others get the default model (Kimi K2.5).
 * Falls back gracefully if premium model is not configured.
 */
export function getModelForAgent(agentName: string): LanguageModel {
  if (agentModelCache[agentName]) {
    return agentModelCache[agentName];
  }

  const model = PREMIUM_AGENTS.has(agentName)
    ? getPremiumModel()
    : getModel();

  agentModelCache[agentName] = model;
  return model;
}

/**
 * Clears all cached models. Useful when config changes at runtime.
 */
export function resetModel(): void {
  cachedModel = null;
  cachedConfig = null;
  cachedPremiumModel = null;
  cachedPremiumConfig = null;
  for (const key of Object.keys(agentModelCache)) {
    delete agentModelCache[key];
  }
}
