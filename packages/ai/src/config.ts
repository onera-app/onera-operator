export type AIProviderType =
  | "openai"
  | "azure"
  | "anthropic"
  | "openai-compatible";

export interface AIConfig {
  provider: AIProviderType;
  model: string;
  apiKey: string;
  baseURL?: string;
  azureResourceName?: string;
  azureDeploymentName?: string;
}

/**
 * Load the primary (default) AI config from environment variables.
 * This is the cost-efficient model used for high-volume agents.
 */
export function loadAIConfig(): AIConfig {
  const provider = (process.env.AI_PROVIDER || "openai") as AIProviderType;
  const model = process.env.AI_MODEL || "gpt-4o";
  const apiKey = process.env.AI_API_KEY || "";

  if (!apiKey && provider !== "openai-compatible") {
    console.warn(
      `[onera-ai] Warning: AI_API_KEY is not set for provider "${provider}". ` +
        "LLM calls will fail until a valid key is provided."
    );
  }

  return {
    provider,
    model,
    apiKey,
    baseURL: process.env.AI_BASE_URL || undefined,
    azureResourceName: process.env.AI_AZURE_RESOURCE_NAME || undefined,
    azureDeploymentName: process.env.AI_AZURE_DEPLOYMENT_NAME || undefined,
  };
}

/**
 * Load the nano (ultra-cheap) AI config from environment variables.
 * Used for lightweight tasks: narrative rewrites, summaries, classifications.
 *
 * Falls back to the primary config if AI_NANO_MODEL is not set.
 */
export function loadNanoAIConfig(): AIConfig | null {
  const nanoModel = process.env.AI_NANO_MODEL;
  if (!nanoModel) return null;

  const primary = loadAIConfig();
  return {
    provider: (process.env.AI_NANO_PROVIDER || primary.provider) as AIProviderType,
    model: nanoModel,
    apiKey: process.env.AI_NANO_API_KEY || primary.apiKey,
    baseURL: process.env.AI_NANO_BASE_URL || primary.baseURL,
    azureResourceName: primary.azureResourceName,
    azureDeploymentName: process.env.AI_NANO_AZURE_DEPLOYMENT_NAME || nanoModel,
  };
}

/**
 * Load the premium (frontier) AI config from environment variables.
 * Used for quality-critical agents: chat, outreach, research, engineer.
 *
 * Falls back to the primary config if AI_PREMIUM_MODEL is not set,
 * so the system works fine with a single model too.
 */
export function loadPremiumAIConfig(): AIConfig | null {
  const premiumModel = process.env.AI_PREMIUM_MODEL;
  if (!premiumModel) return null;

  // Premium model shares the same provider/key/baseURL by default.
  // Override any of them with AI_PREMIUM_* env vars if needed.
  const primary = loadAIConfig();
  return {
    provider: (process.env.AI_PREMIUM_PROVIDER || primary.provider) as AIProviderType,
    model: premiumModel,
    apiKey: process.env.AI_PREMIUM_API_KEY || primary.apiKey,
    baseURL: process.env.AI_PREMIUM_BASE_URL || primary.baseURL,
    azureResourceName: process.env.AI_PREMIUM_AZURE_RESOURCE_NAME || primary.azureResourceName,
    azureDeploymentName: process.env.AI_PREMIUM_AZURE_DEPLOYMENT_NAME || premiumModel,
  };
}


