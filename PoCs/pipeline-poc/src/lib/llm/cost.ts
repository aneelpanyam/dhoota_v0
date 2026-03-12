import { createServiceSupabase } from "@/lib/supabase/server";
import { logger } from "@/lib/logging/logger";

// ---------------------------------------------------------------------------
// Model pricing (cost per 1M tokens in USD)
// ---------------------------------------------------------------------------

export const MODEL_PRICING = {
  "gpt-5-nano": { input: 0.1, output: 0.4 },
  "gpt-5-mini": { input: 0.4, output: 1.6 },
} as const satisfies Record<string, { input: number; output: number }>;

export type ModelPricingKey = keyof typeof MODEL_PRICING;

// ---------------------------------------------------------------------------
// Cost calculation
// ---------------------------------------------------------------------------

export interface CostResult {
  inputCost: number;
  outputCost: number;
  totalCost: number;
}

export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): CostResult {
  const pricing = MODEL_PRICING[model as ModelPricingKey];
  const inputPerM = pricing?.input ?? 0;
  const outputPerM = pricing?.output ?? 0;

  const inputCost = (inputTokens / 1_000_000) * inputPerM;
  const outputCost = (outputTokens / 1_000_000) * outputPerM;
  const totalCost = inputCost + outputCost;

  return { inputCost, outputCost, totalCost };
}

// ---------------------------------------------------------------------------
// Request-scoped log context
// ---------------------------------------------------------------------------

export interface LlmLogContext {
  tenantId: string;
  userId: string;
  conversationId: string;
  optionId?: string;
}

let _logContext: LlmLogContext | null = null;

export function setLlmLogContext(ctx: LlmLogContext): void {
  _logContext = ctx;
}

export function clearLlmLogContext(): void {
  _logContext = null;
}

export function getLlmLogContext(): LlmLogContext | null {
  return _logContext;
}

// ---------------------------------------------------------------------------
// LLM call logging (fire-and-forget)
// ---------------------------------------------------------------------------

export interface LogLlmCallParams {
  model: string;
  operation: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  success: boolean;
  errorMessage?: string;
}

export function logLlmCall(params: LogLlmCallParams): void {
  const ctx = _logContext;
  const { inputCost, outputCost, totalCost } = calculateCost(
    params.model,
    params.inputTokens,
    params.outputTokens
  );

  createServiceSupabase()
    .from("llm_logs")
    .insert({
      tenant_id: ctx?.tenantId ?? null,
      user_id: ctx?.userId ?? null,
      conversation_id: ctx?.conversationId ?? null,
      option_id: ctx?.optionId ?? null,
      provider: "openai",
      model: params.model,
      operation: params.operation,
      prompt_tokens: params.inputTokens,
      completion_tokens: params.outputTokens,
      latency_ms: params.latencyMs,
      success: params.success,
      error_message: params.errorMessage ?? null,
      input_cost: inputCost,
      output_cost: outputCost,
      total_cost: totalCost,
    })
    .then(
      ({ error }) => { if (error) logger.warn("llm", `llm_logs insert failed: ${error.message}`); },
      (err) => { logger.warn("llm", `llm_logs insert failed: ${err}`); }
    );
}
