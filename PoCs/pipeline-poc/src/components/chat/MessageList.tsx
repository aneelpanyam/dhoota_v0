"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/lib/hooks/use-chat";
import type { WidgetAction } from "@/types/api";
import { MessageBubble } from "./MessageBubble";

interface MessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onAction: (action: WidgetAction) => void;
  onOptionSelect: (optionId: string, params?: Record<string, unknown>) => void;
  onConfirm: (optionId: string, params: Record<string, unknown>) => void;
  onQAResponse: (
    optionId: string,
    params: Record<string, unknown>,
    content?: string
  ) => void;
  onCancel: () => void;
}

export function MessageList({
  messages,
  isLoading,
  onAction,
  onOptionSelect,
  onConfirm,
  onQAResponse,
  onCancel,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6">
      <div className="mx-auto space-y-4">
        {messages.map((message, idx) => (
          <MessageBubble
            key={message.id}
            message={message}
            isLastMessage={idx === messages.length - 1}
            onAction={onAction}
            onOptionSelect={onOptionSelect}
            onConfirm={onConfirm}
            onQAResponse={onQAResponse}
            onCancel={onCancel}
          />
        ))}

        {isLoading && messages.length > 0 && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:-0.3s]" />
              <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" />
            </div>
            <span>Thinking...</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
