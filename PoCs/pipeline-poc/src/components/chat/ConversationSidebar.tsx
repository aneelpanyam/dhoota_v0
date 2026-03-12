"use client";

import { useState, useEffect } from "react";
import { MessageSquarePlus, LogOut, MessageCircle, Menu, X } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { ConversationSummary } from "@/lib/hooks/use-chat";

interface ConversationSidebarProps {
  userDisplayName: string;
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  onNewConversation: () => void;
  onSelectConversation: (id: string) => void;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ConversationSidebar({
  userDisplayName,
  conversations,
  activeConversationId,
  onNewConversation,
  onSelectConversation,
}: ConversationSidebarProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  // Close sidebar on window resize to desktop
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const handler = () => { if (mq.matches) setIsOpen(false); };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  async function handleLogout() {
    const supabase = createBrowserSupabase();
    await supabase.auth.signOut();
    router.push("/login");
  }

  function handleSelect(id: string) {
    onSelectConversation(id);
    setIsOpen(false);
  }

  function handleNewConversation() {
    onNewConversation();
    setIsOpen(false);
  }

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="h-14 border-b flex items-center justify-between px-4 shrink-0">
        <span className="text-xl font-bold text-primary">Dhoota</span>
        <button
          onClick={() => setIsOpen(false)}
          className="md:hidden p-1 rounded-md hover:bg-muted text-muted-foreground"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* New conversation */}
      <div className="p-3">
        <button
          onClick={handleNewConversation}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-muted-foreground/30 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition"
        >
          <MessageSquarePlus className="h-4 w-4" />
          New Conversation
        </button>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto px-3 space-y-0.5">
        {conversations.length === 0 && (
          <p className="text-xs text-muted-foreground px-2 py-4">
            No conversations yet.
          </p>
        )}
        {conversations.map((conv) => {
          const isActive = conv.id === activeConversationId;
          return (
            <button
              key={conv.id}
              onClick={() => handleSelect(conv.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition flex items-start gap-2.5 group ${
                isActive
                  ? "bg-primary/10 text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <MessageCircle className={`h-4 w-4 mt-0.5 shrink-0 ${isActive ? "text-primary" : ""}`} />
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium">
                  {conv.title || "New Conversation"}
                </p>
                <p className="text-xs opacity-60 mt-0.5">
                  {formatRelativeTime(conv.updated_at)}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* User */}
      <div className="p-3 border-t">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary shrink-0">
              {userDisplayName?.[0]?.toUpperCase() ?? "U"}
            </div>
            <span className="text-sm truncate">{userDisplayName || "User"}</span>
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setIsOpen(true)}
        className="md:hidden fixed top-3 left-3 z-40 p-2 rounded-lg bg-card border shadow-sm text-muted-foreground hover:text-foreground transition"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Desktop sidebar (always visible) */}
      <div className="hidden md:flex w-64 border-r bg-muted/30 flex-col shrink-0">
        {sidebarContent}
      </div>

      {/* Mobile overlay sidebar */}
      {isOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/40"
            onClick={() => setIsOpen(false)}
          />
          <div className="md:hidden fixed inset-y-0 left-0 z-50 w-72 bg-card flex flex-col shadow-xl animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </>
      )}
    </>
  );
}
