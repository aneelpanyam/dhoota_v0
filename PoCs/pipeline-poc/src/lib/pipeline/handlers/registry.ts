import type { PipelineHandler } from "./types";

const handlers = new Map<string, PipelineHandler>();

export function registerHandler(id: string, handler: PipelineHandler): void {
  handlers.set(id, handler);
}

export function getHandler(id: string): PipelineHandler | undefined {
  return handlers.get(id);
}
