"use client";

import { useState, useEffect, useCallback } from "react";
import { Bug, X, ChevronDown, ChevronRight, CheckCircle2, XCircle, Clock } from "lucide-react";
import type { PipelineTraceData, PipelineStep } from "@/lib/pipeline/trace";

interface StoredTrace {
  messageId: string;
  timestamp: string;
  trace: PipelineTraceData;
}

interface DebugPanelProps {
  conversationId: string | null;
}

export function DebugPanel({ conversationId }: DebugPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [traces, setTraces] = useState<StoredTrace[]>([]);
  const [expandedTrace, setExpandedTrace] = useState<string | null>(null);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  const loadTraces = useCallback(async () => {
    if (!conversationId) {
      setTraces([]);
      return;
    }
    try {
      const res = await fetch(`/api/chat/conversations/${conversationId}`);
      if (!res.ok) { setTraces([]); return; }
      const data = await res.json();
      const msgs = data.messages ?? [];
      const parsed: StoredTrace[] = [];
      for (const msg of msgs) {
        const meta = msg.metadata ?? msg.response?.debugTrace;
        const trace = meta?.debugTrace ?? meta;
        if (trace?.traceId && trace?.steps) {
          parsed.push({
            messageId: msg.messageId ?? msg.id ?? "",
            timestamp: msg.createdAt ?? msg.created_at ?? new Date().toISOString(),
            trace: trace as PipelineTraceData,
          });
        }
      }
      setTraces(parsed);
    } catch {
      try {
        const key = `dhoota_debug_${conversationId}`;
        const raw = localStorage.getItem(key);
        if (raw) {
          setTraces(JSON.parse(raw) as StoredTrace[]);
        } else {
          setTraces([]);
        }
      } catch {
        setTraces([]);
      }
    }
  }, [conversationId]);

  useEffect(() => {
    if (isOpen) loadTraces();
  }, [isOpen, loadTraces]);

  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(loadTraces, 3000);
    return () => clearInterval(interval);
  }, [isOpen, loadTraces]);

  const clearTraces = () => {
    if (!conversationId) return;
    localStorage.removeItem(`dhoota_debug_${conversationId}`);
    setTraces([]);
  };

  if (!conversationId) return null;

  return (
    <>
      {/* Floating bubble */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`hidden md:flex fixed bottom-20 right-6 z-50 w-12 h-12 rounded-full shadow-lg items-center justify-center transition-all hover:scale-105 ${
          isOpen
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground hover:bg-muted/80"
        }`}
        title="Debug Logs"
      >
        <Bug className="h-5 w-5" />
        {traces.length > 0 && !isOpen && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
            {traces.length}
          </span>
        )}
      </button>

      {/* Panel */}
      {isOpen && (
        <div className="fixed bottom-20 right-6 z-50 w-[480px] max-h-[70vh] rounded-xl border bg-card shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <Bug className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Pipeline Debug</span>
              <span className="text-xs text-muted-foreground">
                {traces.length} trace{traces.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {traces.length > 0 && (
                <button
                  onClick={clearTraces}
                  className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded transition"
                >
                  Clear
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded hover:bg-muted transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Trace list */}
          <div className="flex-1 overflow-y-auto">
            {traces.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No debug traces yet. Interact with the chat to generate traces.
              </div>
            ) : (
              <div className="divide-y">
                {[...traces].reverse().map((entry, idx) => {
                  const traceKey = `${entry.messageId}-${idx}`;
                  const isExpanded = expandedTrace === traceKey;
                  const t = entry.trace;

                  return (
                    <div key={traceKey}>
                      <button
                        onClick={() => setExpandedTrace(isExpanded ? null : traceKey)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/30 transition"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium truncate">
                              {t.request.optionId ?? t.request.source}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                              {t.request.source}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {t.totalDurationMs}ms
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {t.steps.length} step{t.steps.length !== 1 ? "s" : ""}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(entry.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                        </div>
                        {t.steps.every((s) => s.success) ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive shrink-0" />
                        )}
                      </button>

                      {isExpanded && (
                        <div className="px-4 pb-3 space-y-1">
                          {t.steps.map((step, si) => (
                            <StepRow
                              key={si}
                              step={step}
                              stepKey={`${traceKey}-${si}`}
                              expandedStep={expandedStep}
                              onToggle={setExpandedStep}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function StepRow({
  step,
  stepKey,
  expandedStep,
  onToggle,
}: {
  step: PipelineStep;
  stepKey: string;
  expandedStep: string | null;
  onToggle: (key: string | null) => void;
}) {
  const isExpanded = expandedStep === stepKey;
  const hasDetails = step.input || step.output || step.error || step.llm || step.sql;
  const hasLlm = !!step.llm;
  const hasSql = step.sql && step.sql.length > 0;

  return (
    <div className="rounded-lg border bg-background">
      <button
        onClick={() => hasDetails && onToggle(isExpanded ? null : stepKey)}
        className={`w-full flex items-center gap-2 px-3 py-1.5 text-left ${
          hasDetails ? "cursor-pointer hover:bg-muted/30" : "cursor-default"
        } transition`}
      >
        {step.success ? (
          <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
        ) : (
          <XCircle className="h-3 w-3 text-destructive shrink-0" />
        )}
        <span className="text-xs font-mono flex-1 truncate">{step.name}</span>
        <div className="flex items-center gap-1 shrink-0">
          {hasLlm && <span className="text-[9px] px-1 py-0.5 rounded bg-purple-100 text-purple-700 font-medium">LLM</span>}
          {hasSql && <span className="text-[9px] px-1 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">SQL</span>}
          <span className="text-[10px] text-muted-foreground">{step.durationMs}ms</span>
        </div>
        {hasDetails && (
          isExpanded ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
          )
        )}
      </button>

      {isExpanded && hasDetails && (
        <div className="px-3 pb-2 space-y-1.5 border-t">
          {step.error && (
            <div className="mt-1.5">
              <span className="text-[10px] font-semibold text-destructive">Error:</span>
              <pre className="text-[10px] text-destructive bg-destructive/5 rounded p-1.5 mt-0.5 whitespace-pre-wrap break-all">
                {step.error}
              </pre>
            </div>
          )}

          {step.llm && (
            <div className="mt-1.5 space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold text-purple-600">LLM Call</span>
                <span className="text-[9px] px-1 py-0.5 rounded bg-purple-50 text-purple-500 font-mono">{step.llm.model}</span>
                {step.llm.finishReason && step.llm.finishReason !== "stop" && (
                  <span className="text-[9px] px-1 py-0.5 rounded bg-amber-100 text-amber-700">{step.llm.finishReason}</span>
                )}
              </div>
              <DebugCollapsible label="System Prompt" color="purple">
                <pre className="text-[10px] text-purple-900/80 bg-purple-50 rounded p-1.5 whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
                  {step.llm.systemPrompt}
                </pre>
              </DebugCollapsible>
              <DebugCollapsible label="User Input" color="purple">
                <pre className="text-[10px] text-purple-900/80 bg-purple-50 rounded p-1.5 whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
                  {step.llm.userInput}
                </pre>
              </DebugCollapsible>
              <DebugCollapsible label="Response" color="green" defaultOpen>
                <pre className="text-[10px] text-green-900/80 bg-green-50 rounded p-1.5 whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
                  {formatJsonString(step.llm.response)}
                </pre>
              </DebugCollapsible>
            </div>
          )}

          {hasSql && (
            <div className="mt-1.5 space-y-1">
              <span className="text-[10px] font-semibold text-blue-600">SQL Queries</span>
              {step.sql!.map((q, qi) => (
                <div key={qi} className="space-y-0.5">
                  <pre className="text-[10px] text-blue-900/80 bg-blue-50 rounded p-1.5 whitespace-pre-wrap break-all max-h-32 overflow-y-auto font-mono">
                    {q.sql}
                  </pre>
                  <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                    <span>Params: [{q.params.map((p) => p === null ? "NULL" : typeof p === "string" ? `'${p.length > 30 ? p.slice(0, 30) + "..." : p}'` : String(p)).join(", ")}]</span>
                    <span>{q.rowCount} row{q.rowCount !== 1 ? "s" : ""}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {step.input && (
            <div className="mt-1.5">
              <DebugCollapsible label="Step Input" color="gray">
                <pre className="text-[10px] text-muted-foreground bg-muted/50 rounded p-1.5 whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
                  {JSON.stringify(step.input, null, 2)}
                </pre>
              </DebugCollapsible>
            </div>
          )}
          {step.output && (
            <div className="mt-1.5">
              <DebugCollapsible label="Step Output" color="gray">
                <pre className="text-[10px] text-muted-foreground bg-muted/50 rounded p-1.5 whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
                  {JSON.stringify(step.output, null, 2)}
                </pre>
              </DebugCollapsible>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DebugCollapsible({
  label,
  color,
  defaultOpen = false,
  children,
}: {
  label: string;
  color: "purple" | "green" | "blue" | "gray";
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const colors = {
    purple: "text-purple-600",
    green: "text-green-600",
    blue: "text-blue-600",
    gray: "text-muted-foreground",
  };
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1 text-[10px] font-medium ${colors[color]} hover:underline`}
      >
        {open ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
        {label}
      </button>
      {open && children}
    </div>
  );
}

function formatJsonString(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}
