import type { LLMProvider } from "./provider";
import { OpenAIProvider } from "./openai";

let providerInstance: LLMProvider | null = null;

export function getLLMProvider(): LLMProvider {
  if (!providerInstance) {
    providerInstance = new OpenAIProvider();
  }
  return providerInstance;
}
