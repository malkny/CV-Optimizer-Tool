import { Anthropic } from "@anthropic-ai/sdk";

let anthropicClientInstance: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (anthropicClientInstance) {
    return anthropicClientInstance;
  }

  const baseURL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;

  if (!baseURL) {
    throw new Error(
      "AI_INTEGRATIONS_ANTHROPIC_BASE_URL must be set. Did you forget to provision the Anthropic AI integration?",
    );
  }

  if (!apiKey) {
    throw new Error(
      "AI_INTEGRATIONS_ANTHROPIC_API_KEY must be set. Did you forget to provision the Anthropic AI integration?",
    );
  }

  anthropicClientInstance = new Anthropic({
    apiKey,
    baseURL,
  });

  return anthropicClientInstance;
}
