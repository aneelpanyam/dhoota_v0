# Step 08: AI Engine + Activity Intelligence

## Goal

Build the AI provider abstraction layer and integrate it into activity creation — auto-generating titles, well-formed descriptions, and next-steps guidance. This makes the app "smart."

## Acceptance Criteria

- [ ] Migration `004_ai_and_costs.sql`: `ai_provider_config`, `llm_cost_logs`
- [ ] `ai_provider_config` table: id, provider (enum: openai, gemini, perplexity), model_name, api_key_ref (reference, not plaintext), is_default, is_active, config (JSONB — temperature, max_tokens, etc.), created_at, updated_at
- [ ] `llm_cost_logs` table: id, provider, model, operation (enum: title_generation, description_generation, activity_summary, workspace_summary, insights, guidance), input_tokens, output_tokens, latency_ms, cost_usd (calculated), space_id (FK), user_id (FK), trace_id, created_at
- [ ] AI provider abstraction (`src/lib/llm/provider.ts`) — strategy pattern:
  - `LLMProvider` interface: `complete(prompt, options) -> LLMResponse`
  - `OpenAIProvider`, `GeminiProvider`, `PerplexityProvider` implementations
  - `getProvider(operation?) -> LLMProvider` factory — returns active provider (or operation-specific one)
- [ ] LLM cost logger (`src/lib/llm/cost-logger.ts`) — logs every LLM call to `llm_cost_logs` with all fields
- [ ] Prompt templates (`src/lib/llm/prompts/`) — structured prompts for each operation:
  - `title-generation.ts` — generate concise title from raw_description
  - `description-generation.ts` — generate well-formed description from raw_description + context
  - `activity-summary.ts` — generate insights, guidance, assessment for one activity
  - `next-steps.ts` — suggest next steps after activity creation
- [ ] Activity creation hook: after saving activity, trigger title + description generation (async, non-blocking)
- [ ] Activity detail: show AI-generated title and well_formed_description (with loading state while generating)
- [ ] Next-steps guidance: show suggested next steps after activity is created (in success screen or toast-like panel)
- [ ] Per-activity summary: on activity detail page, show AI insights/guidance/assessment (generate on demand or on first view)
- [ ] All LLM calls: logged to `llm_cost_logs`, logged to structured logger with trace_id, error responses include trace_id
- [ ] Graceful degradation: if AI call fails, activity still saves; AI fields remain null; user sees non-blocking error

## Key Files (expected)

```
supabase/migrations/004_ai_and_costs.sql
src/lib/llm/provider.ts
src/lib/llm/providers/openai.ts
src/lib/llm/providers/gemini.ts
src/lib/llm/providers/perplexity.ts
src/lib/llm/cost-logger.ts
src/lib/llm/prompts/title-generation.ts
src/lib/llm/prompts/description-generation.ts
src/lib/llm/prompts/activity-summary.ts
src/lib/llm/prompts/next-steps.ts
src/lib/llm/index.ts
src/lib/services/ai.ts
```

## Dependencies

- Step 06 (activities schema — title, well_formed_description fields)

## Context to Read

- `PLAN.md` — AI Provider Abstraction, Observability (LLM cost)
- `ARCHITECTURE.md` — service layer pattern, error handling, logging
- `CONTEXT.md` — Steps 01–06 decisions (especially activity schema, tracing)

## Testing Requirements

- [ ] Provider factory: returns correct provider based on config; falls back to default
- [ ] Cost logger: logs all required fields; handles missing optional fields gracefully
- [ ] Title generation: given raw_description, returns non-empty title; logged to cost table
- [ ] Graceful degradation: AI failure doesn't prevent activity save

## Notes

- **AI is a core module, not an afterthought.** Design the abstraction to support many operations — the list will grow.
- Strategy pattern for providers: each provider implements the same interface. Adding a new provider = one new file.
- API keys should NOT be stored in the database as plaintext. `api_key_ref` is a reference to an env var name (e.g., `OPENAI_API_KEY`). The provider reads from `process.env`.
- Cost calculation: each provider has different pricing. Store input/output tokens and calculate cost using provider-specific rates (can be in config JSONB or hardcoded initially).
- Title generation should be fast (< 2 seconds) — use a small/fast model. Description generation can be slower.
- Non-blocking AI: use a pattern where the activity saves immediately, then AI runs async. Update the activity record when AI completes. The UI polls or uses optimistic updates.
- Prompt templates should include context: the category name, existing answers, tags — the more context, the better the AI output.
- Consider a simple retry mechanism (1-2 retries) for transient AI failures.
