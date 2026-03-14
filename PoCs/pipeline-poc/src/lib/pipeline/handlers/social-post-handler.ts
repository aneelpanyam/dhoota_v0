import { createServiceSupabase } from "@/lib/supabase/server";
import { getLLMProvider } from "@/lib/llm/factory";
import type { SqlResult } from "@/types/pipeline";
import type { PipelineHandler, PipelineHandlerContext } from "./types";

export const socialPostHandler: PipelineHandler = {
  async execute(optionId, params, context) {
    const activityId = params.activity_id as string | undefined;
    if (!activityId) {
      return [{
        templateName: "social_post",
        rows: [{ error: "activity_id is required" }],
        rowCount: 1,
        queryType: "read" as const,
      }];
    }

    const db = createServiceSupabase();

    const { data: activity } = await db
      .from("activities")
      .select("id, title, description, ai_summary, activity_date, location")
      .eq("id", activityId)
      .eq("tenant_id", context.tenantId)
      .is("deleted_at", null)
      .single();

    if (!activity) {
      return [{
        templateName: "social_post",
        rows: [{ error: "Activity not found" }],
        rowCount: 1,
        queryType: "read" as const,
      }];
    }

    const { data: media } = await db
      .from("activity_media")
      .select("id, s3_key, mime_type, original_filename")
      .eq("activity_id", activityId)
      .like("mime_type", "image/%")
      .order("created_at", { ascending: true })
      .limit(5);

    const platform = (params.platform as string) ?? "Twitter";
    const tone = (params.tone as string) ?? "professional";

    const summary = activity.ai_summary as Record<string, unknown> | null;
    const enhancedTitle = summary?.enhancedTitle as string | undefined;
    const enhancedDesc = summary?.enhancedDescription as string | undefined;
    const title = enhancedTitle ?? activity.title ?? "";
    const description = enhancedDesc ?? activity.description ?? "";
    const dateStr = activity.activity_date
      ? new Date(activity.activity_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : "";

    const llm = getLLMProvider();
    const systemPrompt = `You are a social media content writer. Generate a ${platform} post for the following activity.
Tone: ${tone}
Keep it concise and engaging. Use appropriate hashtags for ${platform}. Do not include image captions in the post text.`;
    const userPrompt = `Activity: ${title}
${description ? `Details: ${description}` : ""}
${dateStr ? `Date: ${dateStr}` : ""}
${activity.location ? `Location: ${activity.location}` : ""}

Generate a single ${platform} post.`;

    const postText = await llm.chat(systemPrompt, userPrompt);

    const images = (media ?? []).map((m: { s3_key: string; original_filename: string }) => ({
      s3_key: m.s3_key,
      caption: m.original_filename ?? "",
    }));

    const result: SqlResult = {
      templateName: "social_post",
      rows: [{
        post_text: postText.trim(),
        platform,
        activity_title: title,
        images,
      }],
      rowCount: 1,
      queryType: "read",
    };
    return [result];
  },
};
