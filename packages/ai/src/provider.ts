import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createAzure } from "@ai-sdk/azure";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import { loadAIConfig, loadPremiumAIConfig, loadNanoAIConfig, type AIConfig } from "./config.js";

let cachedModel: LanguageModel | null = null;
let cachedConfig: AIConfig | null = null;
let cachedPremiumModel: LanguageModel | null = null;
let cachedPremiumConfig: AIConfig | null = null;
let cachedNanoModel: LanguageModel | null = null;
let cachedNanoConfig: AIConfig | null = null;

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

  console.log(
    `[onera-ai] Default model: provider=${config.provider} model=${config.model} deployment=${config.azureDeploymentName || "n/a"}`
  );
  cachedConfig = config;
  cachedModel = createModelForProvider(config);
  return cachedModel;
}

/**
 * Returns the premium (frontier) model for quality-critical tasks.
 * Falls back to the default model if AI_PREMIUM_MODEL is not configured.
 *
 * When the premium model hits a rate limit (HTTP 429 / "high demand" errors),
 * it automatically retries the call with the default model (e.g. Kimi K2.5).
 */
export function getPremiumModel(): LanguageModel {
  const premiumConfig = loadPremiumAIConfig();
  if (!premiumConfig) {
    console.warn(
      "[onera-ai] AI_PREMIUM_MODEL is not set — premium agents will fall back to the default model. " +
        "Set AI_PREMIUM_MODEL=gpt-5.4 to enable the premium tier."
    );
    return getModel();
  }

  if (
    cachedPremiumModel &&
    cachedPremiumConfig &&
    cachedPremiumConfig.provider === premiumConfig.provider &&
    cachedPremiumConfig.model === premiumConfig.model &&
    cachedPremiumConfig.apiKey === premiumConfig.apiKey
  ) {
    return cachedPremiumModel;
  }

  console.log(
    `[onera-ai] Premium model: provider=${premiumConfig.provider} model=${premiumConfig.model} deployment=${premiumConfig.azureDeploymentName || "n/a"}`
  );
  cachedPremiumConfig = premiumConfig;

  const primaryModel = createModelForProvider(premiumConfig);
  cachedPremiumModel = createFallbackModel(primaryModel, () => getModel());
  return cachedPremiumModel;
}

/**
 * Detects rate-limit or capacity errors from Azure OpenAI.
 */
function isRateLimitError(err: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("429") ||
    msg.includes("rate limit") ||
    msg.includes("high demand") ||
    msg.includes("exceeded") ||
    msg.includes("throttl") ||
    msg.includes("capacity") ||
    msg.includes("overloaded") ||
    msg.includes("peak load")
  );
}

/**
 * Wraps a primary LanguageModel with a fallback.
 * If doGenerate or doStream fails with a rate-limit error, retries with the fallback model.
 * Delegates all properties and methods to the primary, swaps to fallback only on rate-limit.
 */
function createFallbackModel(
  primary: LanguageModel,
  getFallback: () => LanguageModel
): LanguageModel {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = primary as any;

  const proxy = {
    specificationVersion: p.specificationVersion,
    provider: p.provider,
    modelId: `${p.modelId}->fallback`,
    defaultObjectGenerationMode: p.defaultObjectGenerationMode,
    supportsImageUrls: p.supportsImageUrls,
    supportsStructuredOutputs: p.supportsStructuredOutputs,
    supportsUrl: p.supportsUrl,
    supportedUrls: p.supportedUrls,

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async doGenerate(params: any) {
      try {
        return await p.doGenerate(params);
      } catch (err: unknown) {
        if (isRateLimitError(err)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const f = getFallback() as any;
          console.warn(
            `[onera-ai] Premium model rate-limited, falling back: ${p.modelId} → ${f.modelId}`
          );
          return await f.doGenerate(params);
        }
        throw err;
      }
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async doStream(params: any) {
      try {
        return await p.doStream(params);
      } catch (err: unknown) {
        if (isRateLimitError(err)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const f = getFallback() as any;
          console.warn(
            `[onera-ai] Premium model rate-limited (stream), falling back: ${p.modelId} → ${f.modelId}`
          );
          return await f.doStream(params);
        }
        throw err;
      }
    },
  };

  return proxy as unknown as LanguageModel;
}

/**
 * Returns the nano (ultra-cheap) model for lightweight tasks like narrative rewrites.
 * Falls back to the default model if AI_NANO_MODEL is not configured.
 */
export function getNanoModel(): LanguageModel {
  const nanoConfig = loadNanoAIConfig();
  if (!nanoConfig) {
    return getModel();
  }

  if (
    cachedNanoModel &&
    cachedNanoConfig &&
    cachedNanoConfig.provider === nanoConfig.provider &&
    cachedNanoConfig.model === nanoConfig.model &&
    cachedNanoConfig.apiKey === nanoConfig.apiKey
  ) {
    return cachedNanoModel;
  }

  console.log(
    `[onera-ai] Nano model: provider=${nanoConfig.provider} model=${nanoConfig.model} deployment=${nanoConfig.azureDeploymentName || "n/a"}`
  );
  cachedNanoConfig = nanoConfig;
  cachedNanoModel = createModelForProvider(nanoConfig);
  return cachedNanoModel;
}

function createModelForProvider(config: AIConfig): LanguageModel {
  console.log(
    `[onera-ai] Creating ${config.provider} model: model=${config.model}` +
      (config.azureDeploymentName ? ` deployment=${config.azureDeploymentName}` : "") +
      (config.baseURL ? ` baseURL=${config.baseURL.replace(/\/+$/, "").slice(0, 60)}` : "")
  );
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

  const isPremium = PREMIUM_AGENTS.has(agentName);
  const model = isPremium ? getPremiumModel() : getModel();

  console.log(
    `[onera-ai] Agent "${agentName}" → ${isPremium ? "premium" : "default"} tier`
  );

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
  cachedNanoModel = null;
  cachedNanoConfig = null;
  for (const key of Object.keys(agentModelCache)) {
    delete agentModelCache[key];
  }
}
