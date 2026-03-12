import { createServiceSupabase } from "@/lib/supabase/server";
import type { SessionUser } from "@/types/auth";
import type { UserContext, ConversationMessage } from "@/types/pipeline";
import type { OptionDefinition } from "@/types/options";
import {
  loadUserTypeConfig,
  loadUserConfig,
  loadOptionDefinitions,
} from "./loader";

export async function buildUserContext(
  session: SessionUser,
  conversationId: string
): Promise<UserContext> {
  const typeConfig = await loadUserTypeConfig(session.userType);
  const userConfig = await loadUserConfig(session.id);

  const availableIds =
    userConfig?.available_option_ids ?? typeConfig?.available_option_ids ?? [];
  const defaultIds =
    userConfig?.default_option_ids ?? typeConfig?.default_option_ids ?? [];
  const initIds =
    userConfig?.init_option_ids ?? typeConfig?.init_option_ids ?? [];

  const allOptions = await loadOptionDefinitions();

  const tenantFlags = await loadTenantFlags(session.tenantId);

  const availableOptions = allOptions.filter(
    (opt) =>
      availableIds.includes(opt.id) &&
      opt.user_types.includes(session.userType) &&
      opt.required_toggles.every((toggle) => tenantFlags.includes(toggle))
  );

  const defaultOptions = availableOptions.filter((opt) =>
    defaultIds.includes(opt.id)
  );

  const recentMessages = await loadRecentMessages(conversationId);

  return {
    tenantId: session.tenantId,
    userId: session.id,
    userType: session.userType,
    displayName: session.displayName,
    availableOptions,
    defaultOptions,
    initOptionIds: initIds,
    conversationId,
    recentMessages,
  };
}

async function loadTenantFlags(tenantId: string): Promise<string[]> {
  const db = createServiceSupabase();
  const { data } = await db
    .from("tenant_feature_flags")
    .select("flag_key")
    .eq("tenant_id", tenantId)
    .eq("enabled", true);

  return data?.map((f: { flag_key: string }) => f.flag_key) ?? [];
}

async function loadRecentMessages(
  conversationId: string
): Promise<ConversationMessage[]> {
  const db = createServiceSupabase();
  const { data } = await db
    .from("messages")
    .select("role, content, option_id, input_params, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    data?.reverse().map((m: Record<string, unknown>) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content as string | null,
      optionId: m.option_id as string | null,
      inputParams: (m.input_params as Record<string, unknown>) ?? undefined,
      createdAt: m.created_at as string,
    })) ?? []
  );
}

export function optionsToReferences(options: OptionDefinition[]) {
  return options
    .sort((a, b) => (a.default_priority ?? 100) - (b.default_priority ?? 100))
    .map((opt) => ({
      optionId: opt.id,
      name: opt.name,
      icon: opt.icon ?? "Zap",
      description: opt.description,
    }));
}
