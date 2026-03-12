"use client";

import { useEffect, useRef } from "react";
import { useChat } from "@/lib/hooks/use-chat";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { ConversationSidebar } from "./ConversationSidebar";
import { DebugPanel } from "./DebugPanel";
import { Loader2 } from "lucide-react";

export function ChatContainer() {
  const chat = useChat();
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      chat.initialize();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-screen w-full bg-background">
      <ConversationSidebar
        userDisplayName={chat.userDisplayName}
        conversations={chat.conversations}
        activeConversationId={chat.conversationId}
        onNewConversation={chat.startNewConversation}
        onSelectConversation={chat.loadConversation}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-14 border-b flex items-center px-6 pl-14 md:pl-6 shrink-0">
          <h1 className="text-lg font-semibold">Dhoota</h1>
          {chat.isLoading && (
            <Loader2 className="ml-3 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </header>

        {/* Messages */}
        <MessageList
          messages={chat.messages}
          isLoading={chat.isLoading}
          onAction={(action) => {
            chat.sendMessage({
              source: "inline_action",
              optionId: action.optionId,
              params: action.params,
              targetResourceId: action.targetResourceId,
              targetResourceType: action.targetResourceType,
            });
          }}
          onOptionSelect={(optionId, params) => {
            chat.sendMessage({
              source: "default_option",
              optionId,
              params,
            });
          }}
          onConfirm={(optionId, params) => {
            chat.sendMessage({
              source: "confirmation",
              optionId,
              params,
            });
          }}
          onQAResponse={(optionId, params, content) => {
            chat.sendMessage({
              source: "qa_response",
              optionId,
              params,
              content,
            });
          }}
          onCancel={() => chat.cancelAction()}
        />

        {/* Input */}
        <ChatInput
          onSend={(content, files) => {
            chat.sendMessage({
              source: "chat",
              content,
              files,
            });
          }}
          isLoading={chat.isLoading}
          conversationState={chat.conversationState}
        />
      </div>

      <DebugPanel conversationId={chat.conversationId} />
    </div>
  );
}
