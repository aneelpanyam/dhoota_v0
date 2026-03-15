import { createServiceSupabase } from "@/lib/supabase/server";
import type { SessionUser } from "@/types/auth";
import type { UserContext, ConversationMessage } from "@/types/pipeline";
import type { OptionDefinition } from "@/types/options";
import {
  loadUserTypeConfig,
  loadUserConfig,
  loadOptionDefinitions,
} from "./loader";
import { isPublicMode, getPublicUserId } from "@/lib/auth/public-mode";

export async function buildUserContext(
  session: SessionUser,
  conversationId: string
): Promise<UserContext> {
  const typeConfig = await loadUserTypeConfig(session.userType);
  const userConfig = session.userType !== "citizen"
    ? await loadUserConfig(session.id)
    : null;

  const availableIds =
    userConfig?.available_option_ids ?? typeConfig?.available_option_ids ?? [];
  const defaultIds =
    userConfig?.default_option_ids ?? typeConfig?.default_option_ids ?? [];
  const initIds =
    userConfig?.init_option_ids ?? typeConfig?.init_option_ids ?? [];

  const allOptions = await loadOptionDefinitions();
  const tenantFlags = await loadTenantFlags(session.tenantId);
  const tenantOverrides = await loadTenantOptionOverrides(session.tenantId);

  let availableOptions = allOptions.filter(
    (opt) =>
      availableIds.includes(opt.id) &&
      opt.user_types.includes(session.userType) &&
      opt.required_toggles.every((toggle) => tenantFlags.includes(toggle)) &&
      (opt.tenant_id === null || opt.tenant_id === undefined || opt.tenant_id === session.tenantId)
  );

  availableOptions = applyTenantOverrides(availableOptions, tenantOverrides);

  if (isPublicMode() && session.userType === "citizen") {
    const enabledIds = await loadPublicSiteEnabledOptions(session.tenantId, getPublicUserId());
    if (enabledIds.length > 0) {
      availableOptions = availableOptions.filter((opt) => enabledIds.includes(opt.id));
    }
  }

  const defaultOptions = availableOptions.filter((opt) =>
    defaultIds.includes(opt.id)
  );

  const recentMessages = session.userType === "citizen"
    ? []
    : await loadRecentMessages(conversationId);

  const scopedUserId = isPublicMode() ? (getPublicUserId() ?? undefined) : undefined;

  return {
    tenantId: session.tenantId,
    userId: session.id,
    userType: session.userType,
    displayName: session.displayName,
    scopedUserId,
    availableOptions,
    defaultOptions,
    initOptionIds: initIds,
    conversationId,
    recentMessages,
  };
}

interface TenantOptionOverride {
  option_id: string;
  enabled: boolean;
  name_override: string | null;
  description_override: string | null;
  icon_override: string | null;
  priority_override: number | null;
}

function applyTenantOverrides(
  options: OptionDefinition[],
  overrides: TenantOptionOverride[]
): OptionDefinition[] {
  if (overrides.length === 0) return options;

  const overrideMap = new Map(overrides.map((o) => [o.option_id, o]));

  return options
    .filter((opt) => {
      const override = overrideMap.get(opt.id);
      return !override || override.enabled !== false;
    })
    .map((opt) => {
      const override = overrideMap.get(opt.id);
      if (!override) return opt;

      return {
        ...opt,
        name: override.name_override ?? opt.name,
        description: override.description_override ?? opt.description,
        icon: override.icon_override ?? opt.icon,
        default_priority: override.priority_override ?? opt.default_priority,
      };
    });
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

async function loadTenantOptionOverrides(tenantId: string): Promise<TenantOptionOverride[]> {
  const db = createServiceSupabase();
  const { data } = await db
    .from("tenant_option_overrides")
    .select("option_id, enabled, name_override, description_override, icon_override, priority_override")
    .eq("tenant_id", tenantId);

  return (data ?? []) as TenantOptionOverride[];
}

async function loadPublicSiteEnabledOptions(
  tenantId: string,
  userId: string | null
): Promise<string[]> {
  if (!userId) return [];

  const db = createServiceSupabase();
  const { data } = await db
    .from("public_site_configs")
    .select("enabled_option_ids")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .single();

  return (data?.enabled_option_ids as string[]) ?? [];
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

import { isValidOptionIcon } from "@/lib/icons/option-icons";

export function optionsToReferences(options: OptionDefinition[]) {
  return options
    .sort((a, b) => (a.default_priority ?? 100) - (b.default_priority ?? 100))
    .map((opt) => {
      const icon = opt.icon ?? "Zap";
      return {
        optionId: opt.id,
        name: opt.name,
        icon: isValidOptionIcon(icon) ? icon : "Zap",
        description: opt.description,
        loadingMessage: opt.loading_message ?? undefined,
      };
    });
}
