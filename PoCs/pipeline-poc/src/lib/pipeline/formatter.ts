import type { OptionDefinition } from "@/types/options";
import type { SqlResult, FormattedResponse } from "@/types/pipeline";

/**
 * Specialized formatters produce polished output for specific option IDs.
 * Everything else uses the generic deterministic formatter guided by target_widget.
 */
const SPECIALIZED_FORMATTERS: Record<
  string,
  (sqlResults: SqlResult[], option: OptionDefinition, params?: Record<string, unknown>) => FormattedResponse
> = {
  "activity.list": formatActivityList,
  "activity.view": formatActivityView,
  "activity.create": formatActivityWriteResult,
  "activity.edit": formatActivityWriteResult,
  "activity.create_bulk": formatActivityCreateBulk,
  "activity.delete": formatActivityDelete,
  "activity.add_note": formatAddNote,
  "activity.add_media": formatAddMedia,
  "activity.manage_tags": formatActivityManageTags,
  "activity.social_post": formatActivitySocialPost,
  "view.stats": formatStats,
  "public.stats": formatStats,
  "tag.manage": formatTagList,
  "tag.create": formatTagCreate,
  "bookmark.list": formatBookmarkList,
  "analysis.activities": formatAnalysisActivityList,
  "analysis.specific_activity": formatAnalysisActivityList,
  "analysis.tags": formatAnalysisTags,
  "analysis.timeline": formatAnalysisTimeline,
  "analysis.notes": formatAnalysisNotes,
  "admin.option.view": formatAdminOptionView,
  "admin.conversation.view": formatAdminConversationView,
  "admin.trace.lookup": formatAdminTraceLookup,
  "admin.tenant.view": formatAdminTenantView,
  "admin.user.view": formatAdminUserView,
};

export async function formatResponse(
  option: OptionDefinition | null,
  sqlResults: SqlResult[],
  _context: unknown,
  params?: Record<string, unknown>
): Promise<FormattedResponse> {
  if (!option) {
    return {
      summary: "Here are the results.",
      widgets: sqlResults.flatMap((r) =>
        r.rows.length > 0
          ? [{ type: "data_list", data: { items: r.rows, columns: pickDisplayColumns(r.rows[0]) } }]
          : []
      ),
      followUpOptionIds: [],
    };
  }

  const specializedFn = SPECIALIZED_FORMATTERS[option.id];
  if (specializedFn) {
    return specializedFn(sqlResults, option, params);
  }

  return formatGenericResults(sqlResults, option, params);
}

// ────────────────────────────────────────────
// Generic deterministic formatter
// Uses target_widget from option config when available,
// falls back to heuristic detection.
// ────────────────────────────────────────────

const HIDDEN_KEYS = new Set([
  "metadata", "deleted_at", "tenant_id", "auth_user_id",
  "created_at", "updated_at", "owner_user_id", "created_by",
]);

const LABEL_MAP: Record<string, string> = {
  total_activities: "Total Activities",
  this_month: "This Month",
  this_week: "This Week",
  total_input_tokens: "Input Tokens",
  total_output_tokens: "Output Tokens",
  total_cost: "Total Cost",
  call_count: "LLM Calls",
  execution_count: "Executions",
  avg_ms: "Avg Latency (ms)",
  error_count: "Errors",
  user_count: "Users",
  message_count: "Messages",
  suggestion_count: "Suggestions",
  new_count: "New",
  note_count: "Notes",
  member_count: "Members",
  media_count: "Media",
  activity_count: "Activities",
};

function humanLabel(key: string): string {
  return LABEL_MAP[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function isUuid(v: unknown): boolean {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(v);
}

const TITLE_PRIORITY = new Set([
  "name", "title", "label", "display_name", "email", "slug",
  "option_name", "box_title", "tenant_name", "flag_name",
]);
const BADGE_PRIORITY = new Set([
  "status", "user_type", "subscription", "visibility", "type",
  "source", "context", "card_type", "report_type", "suggestion_status",
]);
const BOOLEAN_PRIORITY = new Set([
  "is_active", "pinned", "enabled", "override_enabled", "success",
]);
const SENSITIVE_KEYS = new Set(["access_code", "password", "secret"]);

function pickDisplayColumns(row: Record<string, unknown>, opts?: { includeSensitive?: boolean }): { key: string; label: string }[] {
  const titleCols: string[] = [];
  const badgeCols: string[] = [];
  const boolCols: string[] = [];
  const countCols: string[] = [];
  const regularCols: string[] = [];
  const objectCols: string[] = [];

  for (const k of Object.keys(row)) {
    if (HIDDEN_KEYS.has(k) || k === "id") continue;
    const sample = row[k];
    if (isUuid(sample)) continue;
    if (k.endsWith("_id") && typeof sample === "string") continue;

    if (TITLE_PRIORITY.has(k)) {
      titleCols.push(k);
    } else if (BADGE_PRIORITY.has(k)) {
      badgeCols.push(k);
    } else if (BOOLEAN_PRIORITY.has(k)) {
      boolCols.push(k);
    } else if (k.endsWith("_count") || k === "count") {
      countCols.push(k);
    } else if (sample !== null && typeof sample === "object") {
      objectCols.push(k);
    } else if (SENSITIVE_KEYS.has(k)) {
      if (opts?.includeSensitive) regularCols.push(k);
    } else {
      regularCols.push(k);
    }
  }

  const ordered = [
    ...titleCols,
    ...badgeCols,
    ...boolCols,
    ...countCols,
    ...regularCols.slice(0, 5),
    ...objectCols.slice(0, 2),
  ].slice(0, 10);

  return ordered.map((k) => ({ key: k, label: humanLabel(k) }));
}

function isNumericRow(row: Record<string, unknown>, keys: string[]): boolean {
  return keys.length > 0 && keys.every((k) => {
    const v = row[k];
    return typeof v === "number" || typeof v === "bigint";
  });
}

export function deriveItemActions(
  followUpOptionIds: string[]
): { viewOptionId?: string; viewParamKey?: string; editOptionId?: string; editParamKey?: string } {
  const viewId = followUpOptionIds.find((id) => /\.(view|details)$/.test(id));
  const editId = followUpOptionIds.find((id) => /\.edit$/.test(id));

  function paramKeyFromOptionId(optionId: string): string {
    const parts = optionId.split(".");
    parts.pop();
    if (["admin", "public", "citizen"].includes(parts[0])) parts.shift();
    return `${parts.join("_")}_id`;
  }

  return {
    viewOptionId: viewId,
    viewParamKey: viewId ? paramKeyFromOptionId(viewId) : undefined,
    editOptionId: editId,
    editParamKey: editId ? paramKeyFromOptionId(editId) : undefined,
  };
}

function formatGenericResults(
  sqlResults: SqlResult[],
  option: OptionDefinition,
  params?: Record<string, unknown>
): FormattedResponse {
  const widgets: FormattedResponse["widgets"] = [];
  let hasWrite = false;
  const targetWidget = option.target_widget;

  for (const result of sqlResults) {
    if (result.queryType === "write") hasWrite = true;
    if (result.rows.length === 0) continue;

    const firstRow = result.rows[0];

    // Write result with returned entity data: show as a rich data list
    if (result.queryType === "write") {
      const columns = pickDisplayColumns(firstRow, { includeSensitive: true });
      if (columns.length > 0) {
        widgets.push({
          type: "data_list",
          data: {
            items: result.rows,
            columns,
            totalItems: result.rows.length,
            page: 1,
            pageSize: result.rows.length,
          },
        });
      }
      continue;
    }

    // If option declares target_widget, use it directly
    if (targetWidget === "stats_card") {
      const displayKeys = Object.keys(firstRow).filter(
        (k) => !HIDDEN_KEYS.has(k) && k !== "id"
      );
      if (result.rows.length === 1 && isNumericRow(firstRow, displayKeys)) {
        for (const key of displayKeys) {
          const rawValue = firstRow[key];
          const formatted = key.includes("cost")
            ? `$${Number(rawValue).toFixed(4)}`
            : key.includes("avg")
              ? `${Number(rawValue).toFixed(0)}`
              : String(rawValue);
          widgets.push({
            type: "stats_card",
            data: { label: humanLabel(key), value: formatted, trend: "flat" },
          });
        }
      } else {
        // Multiple rows with stats_card target -- emit individual stats or fall through to chart
        for (const row of result.rows) {
          const keys = Object.keys(row).filter((k) => !HIDDEN_KEYS.has(k) && k !== "id");
          const numKeys = keys.filter((k) => typeof row[k] === "number");
          for (const nk of numKeys) {
            widgets.push({
              type: "stats_card",
              data: { label: humanLabel(nk), value: String(row[nk]), trend: "flat" },
            });
          }
        }
      }
      continue;
    }

    if (targetWidget === "chart") {
      const allKeys = Object.keys(firstRow);
      const stringKeys = allKeys.filter(
        (k) => typeof firstRow[k] === "string" && !isUuid(firstRow[k]) && !HIDDEN_KEYS.has(k)
      );
      const numericKeys = allKeys.filter(
        (k) => typeof firstRow[k] === "number" && !HIDDEN_KEYS.has(k)
      );
      const labelKey = stringKeys[0] ?? allKeys[0];
      const valueCols = numericKeys.length > 0 ? numericKeys : allKeys.filter((k) => k !== labelKey).slice(0, 3);

      widgets.push({
        type: "chart",
        data: {
          chartType: "bar",
          title: humanLabel(result.templateName),
          labels: result.rows.map((r) => String(r[labelKey])),
          datasets: valueCols.slice(0, 3).map((col) => ({
            label: humanLabel(col),
            data: result.rows.map((r) => Number(r[col]) || 0),
          })),
        },
      });
      continue;
    }

    if (targetWidget === "data_list" || targetWidget === null || targetWidget === undefined) {
      // Heuristic: single-row all-numeric = stats_card (when no target_widget set)
      if (!targetWidget) {
        const displayKeys = Object.keys(firstRow).filter(
          (k) => !HIDDEN_KEYS.has(k) && k !== "id"
        );
        if (result.rows.length === 1 && isNumericRow(firstRow, displayKeys)) {
          for (const key of displayKeys) {
            const rawValue = firstRow[key];
            const formatted = key.includes("cost")
              ? `$${Number(rawValue).toFixed(4)}`
              : key.includes("avg")
                ? `${Number(rawValue).toFixed(0)}`
                : String(rawValue);
            widgets.push({
              type: "stats_card",
              data: { label: humanLabel(key), value: formatted, trend: "flat" },
            });
          }
          continue;
        }

        // Heuristic: multi-row grouped numeric without id = chart
        const isEntityList = "id" in firstRow;
        if (result.rows.length > 1 && !isEntityList) {
          const allKeys = Object.keys(firstRow);
          const stringKeys = allKeys.filter(
            (k) => typeof firstRow[k] === "string" && !isUuid(firstRow[k]) && !HIDDEN_KEYS.has(k)
          );
          const numericKeys = allKeys.filter(
            (k) => typeof firstRow[k] === "number" && !HIDDEN_KEYS.has(k)
          );
          if (stringKeys.length >= 1 && numericKeys.length >= 1 && result.rows.length <= 20) {
            const labelKey = stringKeys[0];
            widgets.push({
              type: "chart",
              data: {
                chartType: "bar",
                title: humanLabel(result.templateName),
                labels: result.rows.map((r) => String(r[labelKey])),
                datasets: numericKeys.slice(0, 3).map((nk) => ({
                  label: humanLabel(nk),
                  data: result.rows.map((r) => Number(r[nk]) || 0),
                })),
              },
            });
            continue;
          }
        }
      }

      // Default: data_list
      const columns = pickDisplayColumns(firstRow);
      if (columns.length > 0) {
        const itemActions = deriveItemActions(option.follow_up_option_ids ?? []);
        const currentPage = Number(params?.page ?? 1);
        const currentPageSize = Number(params?.pageSize ?? 10);
        widgets.push({
          type: "data_list",
          data: {
            items: result.rows,
            columns,
            totalItems: result.rows.length,
            page: currentPage,
            pageSize: currentPageSize,
            paginationOptionId: option.id,
            ...itemActions,
          },
        });
      }
      continue;
    }

    // For any other target_widget (text_response, activity_card, etc.), render as text
    if (targetWidget === "text_response") {
      const text = hasWrite
        ? "Operation completed successfully."
        : JSON.stringify(result.rows, null, 2);
      widgets.push({ type: "text_response", data: { text } });
      continue;
    }

    // Fallback: use target_widget type directly with the row data
    widgets.push({
      type: targetWidget,
      data: result.rows.length === 1 ? result.rows[0] : { items: result.rows },
    });
  }

  if (widgets.length === 0) {
    const summary = hasWrite
      ? "Done! The operation completed successfully."
      : `No ${option.name.toLowerCase().replace(/^(view|list|my)\s+/i, "")} found.`;
    const emptyFollowUps = hasWrite
      ? option.follow_up_option_ids
      : option.follow_up_option_ids.filter((id) => /\.create$/.test(id));
    return {
      summary,
      widgets: [],
      followUpOptionIds: emptyFollowUps,
    };
  }

  const totalRows = sqlResults.reduce((sum, r) => sum + r.rowCount, 0);
  let summary: string;
  if (hasWrite) {
    summary = "Done! Here are the results.";
  } else if (totalRows === 0) {
    summary = `No ${option.name.toLowerCase().replace(/^(view|list|my)\s+/i, "")} found.`;
  } else {
    summary = `Found ${totalRows} result${totalRows !== 1 ? "s" : ""}.`;
  }

  const followUps = totalRows === 0 && !hasWrite
    ? option.follow_up_option_ids.filter((id) => /\.create$/.test(id))
    : option.follow_up_option_ids;

  return { summary, widgets, followUpOptionIds: followUps };
}

// ────────────────────────────────────────────
// Specialized formatters (existing, polished)
// ────────────────────────────────────────────

function formatActivityList(
  sqlResults: SqlResult[],
  option: OptionDefinition,
  params?: Record<string, unknown>
): FormattedResponse {
  const listResult = sqlResults.find((r) => r.templateName === "list_activities");
  const countResult = sqlResults.find((r) => r.templateName === "count_activities");
  const rows = listResult?.rows ?? [];

  const currentPage = Number(params?.page ?? 1);
  const currentPageSize = Number(params?.pageSize ?? 10);
  const totalItems = countResult?.rows[0]?.total_count != null
    ? Number(countResult.rows[0].total_count)
    : rows.length;

  const items = rows.map((row) => {
    const summary = row.ai_summary as Record<string, unknown> | null;
    return {
      ...row,
      title: summary?.enhancedTitle ?? row.title,
      description: summary?.enhancedDescription ?? row.description,
    };
  });

  const columns = [
    { key: "title", label: "Title" },
    { key: "activity_date", label: "Date" },
    { key: "status", label: "Status" },
    { key: "tags", label: "Tags" },
  ];

  const widgets: FormattedResponse["widgets"] = [];

  if (items.length > 0) {
    widgets.push({
      type: "data_list",
      data: {
        items,
        columns,
        totalItems,
        page: currentPage,
        pageSize: currentPageSize,
        paginationOptionId: option.id,
      },
    });
  }

  let summary: string;
  if (totalItems === 0) {
    summary = "You don't have any activities yet. Let's add one!";
  } else if (totalItems > currentPageSize) {
    const start = (currentPage - 1) * currentPageSize + 1;
    const end = Math.min(currentPage * currentPageSize, totalItems);
    summary = `Showing ${start}–${end} of ${totalItems} activit${totalItems === 1 ? "y" : "ies"}.`;
  } else {
    summary = `Here are your ${totalItems} activit${totalItems === 1 ? "y" : "ies"}.`;
  }

  return { summary, widgets, followUpOptionIds: option.follow_up_option_ids };
}

function formatActivityView(
  sqlResults: SqlResult[],
  option: OptionDefinition
): FormattedResponse {
  const activityResult = sqlResults.find((r) => r.templateName === "get_activity");
  const mediaResult = sqlResults.find((r) => r.templateName === "get_media");
  const notesResult = sqlResults.find((r) => r.templateName === "get_notes");

  const activity = activityResult?.rows[0];
  if (!activity) {
    return {
      summary: "Activity not found.",
      widgets: [{ type: "text_response", data: { text: "This activity could not be found or may have been deleted." } }],
      followUpOptionIds: option.follow_up_option_ids,
    };
  }

  const aiSummary = activity.ai_summary as Record<string, unknown> | null;
  const media = mediaResult?.rows ?? [];
  const notes = notesResult?.rows ?? [];

  const cardData: Record<string, unknown> = {
    ...activity,
    title: aiSummary?.enhancedTitle ?? activity.title,
    description: aiSummary?.enhancedDescription ?? activity.description,
    media,
    notes,
    note_count: notes.length,
    media_count: media.length,
  };

  return {
    summary: `Here are the details for "${cardData.title}".`,
    widgets: [{ type: "activity_card", data: cardData }],
    followUpOptionIds: option.follow_up_option_ids,
  };
}

function formatActivityWriteResult(
  sqlResults: SqlResult[],
  option: OptionDefinition
): FormattedResponse {
  const writeResult = sqlResults.find((r) => r.queryType === "write");
  const activity = writeResult?.rows[0];

  if (!activity) {
    return {
      summary: "Done!",
      widgets: [{ type: "text_response", data: { text: "The operation completed successfully." } }],
      followUpOptionIds: option.follow_up_option_ids,
    };
  }

  const isCreate = option.id === "activity.create";
  const title = (activity.title as string) ?? "Activity";

  return {
    summary: isCreate
      ? `"${title}" has been created successfully.`
      : `"${title}" has been updated.`,
    widgets: [{ type: "activity_card", data: activity }],
    followUpOptionIds: option.follow_up_option_ids,
  };
}

function formatActivityCreateBulk(
  sqlResults: SqlResult[],
  option: OptionDefinition
): FormattedResponse {
  const writeResult = sqlResults.find((r) => r.queryType === "write");
  const rows = writeResult?.rows ?? [];
  if (rows.length === 0) {
    return {
      summary: "Activities have been created.",
      widgets: [{ type: "text_response", data: { text: "The operation completed successfully." } }],
      followUpOptionIds: option.follow_up_option_ids,
    };
  }
  const columns = pickDisplayColumns(rows[0], { includeSensitive: false });
  return {
    summary: `${rows.length} activit${rows.length === 1 ? "y" : "ies"} created successfully.`,
    widgets: [{
      type: "data_list",
      data: {
        items: rows,
        columns,
        totalItems: rows.length,
        page: 1,
        pageSize: rows.length,
        viewOptionId: "activity.view",
        viewParamKey: "activity_id",
      },
    }],
    followUpOptionIds: option.follow_up_option_ids,
  };
}

function formatActivityDelete(
  _sqlResults: SqlResult[],
  option: OptionDefinition
): FormattedResponse {
  return {
    summary: "The activity has been deleted.",
    widgets: [{ type: "text_response", data: { text: "The activity has been deleted successfully." } }],
    followUpOptionIds: option.follow_up_option_ids,
  };
}

function formatStats(
  sqlResults: SqlResult[],
  option: OptionDefinition
): FormattedResponse {
  const widgets: FormattedResponse["widgets"] = [];

  for (const result of sqlResults) {
    if (result.rows.length === 0) continue;

    const firstRow = result.rows[0];
    const numericKeys = Object.keys(firstRow).filter(
      (k) => typeof firstRow[k] === "number" || typeof firstRow[k] === "bigint"
    );

    const isSingleAggregate = result.rows.length === 1
      && numericKeys.length === Object.keys(firstRow).length;

    if (isSingleAggregate) {
      const stats = numericKeys.map((key) => ({
        label: humanLabel(key),
        value: String(firstRow[key]),
      }));
      widgets.push({
        type: "stats_grid",
        data: { stats },
      });
    } else if (result.rows.length >= 1) {
      const labelKey = Object.keys(firstRow).find((k) => typeof firstRow[k] === "string") ?? "name";
      const valueKey = Object.keys(firstRow).find((k) => typeof firstRow[k] === "number") ?? "count";

      widgets.push({
        type: "chart",
        data: {
          chartType: "bar",
          title: humanLabel(result.templateName),
          labels: result.rows.map((r) => String(r[labelKey])),
          datasets: [{
            label: humanLabel(valueKey),
            data: result.rows.map((r) => Number(r[valueKey]) || 0),
          }],
        },
      });
    }
  }

  const isPublicStats = option.id === "public.stats";
  const summary =
    widgets.length > 0
      ? isPublicStats
        ? "Here's an overview of activity statistics."
        : "Here's an overview of your activity statistics."
      : isPublicStats
        ? "No statistics available yet."
        : "No statistics available yet. Start adding activities!";

  return { summary, widgets, followUpOptionIds: option.follow_up_option_ids };
}

function formatAddNote(
  sqlResults: SqlResult[],
  option: OptionDefinition
): FormattedResponse {
  const writeResult = sqlResults.find((r) => r.queryType === "write");
  const note = writeResult?.rows[0];

  if (!note) {
    return {
      summary: "Note added.",
      widgets: [{ type: "text_response", data: { text: "Your note has been saved." } }],
      followUpOptionIds: option.follow_up_option_ids,
    };
  }

  const content = (note.content as string) ?? "";
  const createdAt = note.created_at as string;
  const dateStr = createdAt
    ? new Date(createdAt).toLocaleDateString("en-US", {
        month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
      })
    : "";

  return {
    summary: "Note added successfully.",
    widgets: [{
      type: "text_response",
      data: { text: `**Note added** ${dateStr ? `on ${dateStr}` : ""}\n\n> ${content}` },
    }],
    followUpOptionIds: option.follow_up_option_ids,
  };
}

function formatActivityManageTags(
  sqlResults: SqlResult[],
  option: OptionDefinition
): FormattedResponse {
  const activity = sqlResults[0]?.rows[0];
  const title = (activity?.title as string) ?? "Activity";
  return {
    summary: `Tags updated for "${title}".`,
    widgets: [{
      type: "text_response",
      data: { text: `Successfully updated tags for **${title}**.` },
    }],
    followUpOptionIds: option.follow_up_option_ids,
  };
}

function formatActivitySocialPost(
  sqlResults: SqlResult[],
  option: OptionDefinition
): FormattedResponse {
  const result = sqlResults.find((r) => r.templateName === "social_post");
  const row = result?.rows[0] as Record<string, unknown> | undefined;
  if (!row || row.error) {
    return {
      summary: String(row?.error ?? "Failed to generate post."),
      widgets: [{ type: "text_response", data: { text: String(row?.error ?? "Failed to generate post.") } }],
      followUpOptionIds: option.follow_up_option_ids,
    };
  }
  const postText = row.post_text as string;
  const platform = row.platform as string;
  const images = (row.images as Array<{ s3_key: string; caption: string }>) ?? [];
  let text = `### ${platform} Post\n\n${postText}`;
  if (images.length > 0) {
    text += `\n\n**Suggested images** (${images.length}): ${images.map((i) => i.caption || i.s3_key?.slice(-12) || "image").join(", ")}`;
  }
  return {
    summary: `Social post generated for ${platform}.`,
    widgets: [{ type: "text_response", data: { text } }],
    followUpOptionIds: option.follow_up_option_ids,
  };
}

function formatAddMedia(
  sqlResults: SqlResult[],
  option: OptionDefinition
): FormattedResponse {
  const touchResult = sqlResults.find((r) => r.templateName === "touch_activity");
  const activity = touchResult?.rows[0];
  const title = (activity?.title as string) ?? "the activity";

  return {
    summary: `Media attached to "${title}".`,
    widgets: [{
      type: "text_response",
      data: { text: `Successfully attached media to **${title}**.` },
    }],
    followUpOptionIds: option.follow_up_option_ids,
  };
}

function formatTagList(
  sqlResults: SqlResult[],
  option: OptionDefinition
): FormattedResponse {
  const listResult = sqlResults.find((r) => r.templateName === "list_tags");
  const rows = listResult?.rows ?? [];

  if (rows.length === 0) {
    return {
      summary: "No tags found. You can create custom tags to organize your activities.",
      widgets: [{ type: "text_response", data: { text: "No tags found yet. Use **Create Tag** to add your own." } }],
      followUpOptionIds: option.follow_up_option_ids,
    };
  }

  const items = rows.map((tag) => ({
    id: tag.id,
    name: tag.name,
    color: tag.color ?? "#888",
    source: tag.source,
    activity_count: tag.activity_count ?? 0,
  }));

  const systemCount = items.filter((t) => t.source === "system").length;
  const customCount = items.length - systemCount;
  let summary = `You have ${items.length} tag${items.length !== 1 ? "s" : ""}`;
  if (systemCount > 0 && customCount > 0) {
    summary += ` (${systemCount} system, ${customCount} custom)`;
  }
  summary += ".";

  return {
    summary,
    widgets: [{
      type: "data_list",
      data: {
        items,
        columns: [
          { key: "name", label: "Tag" },
          { key: "source", label: "Type" },
          { key: "activity_count", label: "Activities" },
        ],
        totalItems: items.length,
        page: 1,
        pageSize: 50,
      },
    }],
    followUpOptionIds: option.follow_up_option_ids,
  };
}

function formatTagCreate(
  sqlResults: SqlResult[],
  option: OptionDefinition
): FormattedResponse {
  const writeResult = sqlResults.find((r) => r.queryType === "write");
  const tag = writeResult?.rows[0];

  if (!tag) {
    return {
      summary: "Tag created.",
      widgets: [{ type: "text_response", data: { text: "Your tag has been created." } }],
      followUpOptionIds: option.follow_up_option_ids,
    };
  }

  return {
    summary: `Tag "${tag.name}" created successfully.`,
    widgets: [{
      type: "text_response",
      data: { text: `Tag **${tag.name}** has been created. You can now use it when adding or editing activities.` },
    }],
    followUpOptionIds: option.follow_up_option_ids,
  };
}

// ────────────────────────────────────────────
// Analysis formatters
// ────────────────────────────────────────────

function formatAnalysisActivityList(
  sqlResults: SqlResult[],
  option: OptionDefinition
): FormattedResponse {
  const rows = sqlResults.flatMap((r) => r.rows);

  if (rows.length === 0) {
    const noun = option.id === "analysis.specific_activity" ? "matching activities" : "activities";
    return {
      summary: `No ${noun} found. Try adjusting your filters.`,
      widgets: [{ type: "text_response", data: { text: `No ${noun} found with the given criteria.` } }],
      followUpOptionIds: option.follow_up_option_ids.filter((id) => /\.create$/.test(id)),
    };
  }

  const items = rows.map((row) => {
    const aiSummary = row.ai_summary as Record<string, unknown> | null;
    return {
      ...row,
      title: aiSummary?.enhancedTitle ?? row.title,
      description: aiSummary?.enhancedDescription ?? row.description,
    };
  });

  const columns = [
    { key: "title", label: "Title" },
    { key: "activity_date", label: "Date" },
    { key: "status", label: "Status" },
    { key: "tags", label: "Tags" },
  ];

  const count = items.length;
  const summary = option.id === "analysis.specific_activity"
    ? `Found ${count} matching activit${count === 1 ? "y" : "ies"}.`
    : `Found ${count} activit${count === 1 ? "y" : "ies"}.`;

  return {
    summary,
    widgets: [{
      type: "data_list",
      data: {
        items,
        columns,
        totalItems: count,
        page: 1,
        pageSize: 10,
      },
    }],
    followUpOptionIds: option.follow_up_option_ids,
  };
}

function formatAnalysisTags(
  sqlResults: SqlResult[],
  option: OptionDefinition
): FormattedResponse {
  const rows = sqlResults.flatMap((r) => r.rows);

  if (rows.length === 0) {
    return {
      summary: "No tags found.",
      widgets: [{ type: "text_response", data: { text: "No tags found. Create tags to organize your activities." } }],
      followUpOptionIds: option.follow_up_option_ids,
    };
  }

  const items = rows.map((tag) => ({
    id: tag.id,
    name: tag.name,
    color: tag.color ?? "#888",
    source: tag.source,
    activity_count: (tag.activity_count as number) ?? 0,
  }));

  const totalActivities = items.reduce((sum, t) => sum + t.activity_count, 0);
  const systemCount = items.filter((t) => t.source === "system").length;
  const customCount = items.length - systemCount;
  const topTag = items[0];

  const widgets: FormattedResponse["widgets"] = [];

  widgets.push({
    type: "stats_card",
    data: { label: "Total Tags", value: String(items.length), trend: "flat" },
  });
  if (topTag && topTag.activity_count > 0) {
    widgets.push({
      type: "stats_card",
      data: { label: "Most Used", value: topTag.name, trend: "flat" },
    });
  }
  widgets.push({
    type: "stats_card",
    data: { label: "Tagged Activities", value: String(totalActivities), trend: "flat" },
  });

  const chartItems = items.filter((t) => t.activity_count > 0).slice(0, 15);
  if (chartItems.length > 0) {
    widgets.push({
      type: "chart",
      data: {
        chartType: "bar",
        title: "Tag Usage",
        labels: chartItems.map((t) => t.name),
        datasets: [{
          label: "Activities",
          data: chartItems.map((t) => t.activity_count),
        }],
      },
    });
  }

  widgets.push({
    type: "data_list",
    data: {
      items,
      columns: [
        { key: "name", label: "Tag" },
        { key: "source", label: "Type" },
        { key: "activity_count", label: "Activities" },
      ],
      totalItems: items.length,
      page: 1,
      pageSize: 50,
    },
  });

  let summary = `${items.length} tag${items.length !== 1 ? "s" : ""}`;
  if (systemCount > 0 && customCount > 0) {
    summary += ` (${systemCount} system, ${customCount} custom)`;
  }
  summary += ` across ${totalActivities} tagged activit${totalActivities !== 1 ? "ies" : "y"}.`;

  return { summary, widgets, followUpOptionIds: option.follow_up_option_ids };
}

function formatAnalysisTimeline(
  sqlResults: SqlResult[],
  option: OptionDefinition
): FormattedResponse {
  const rows = sqlResults.flatMap((r) => r.rows);

  if (rows.length === 0) {
    return {
      summary: "No timeline data found for the given period.",
      widgets: [{ type: "text_response", data: { text: "No activities found in the selected time range." } }],
      followUpOptionIds: option.follow_up_option_ids,
    };
  }

  const sorted = [...rows].sort((a, b) =>
    String(a.period ?? "").localeCompare(String(b.period ?? ""))
  );

  const totalActivities = sorted.reduce((sum, r) => sum + (Number(r.activity_count) || 0), 0);
  const totalCompleted = sorted.reduce((sum, r) => sum + (Number(r.completed_count) || 0), 0);
  const completionRate = totalActivities > 0
    ? Math.round((totalCompleted / totalActivities) * 100)
    : 0;
  const peakPeriod = sorted.reduce<{ period: string | null; count: number }>(
    (best, r) => (Number(r.activity_count) || 0) > best.count ? { period: (r.period as string) ?? null, count: Number(r.activity_count) || 0 } : best,
    { period: null, count: 0 }
  );

  const widgets: FormattedResponse["widgets"] = [];

  widgets.push({
    type: "stats_card",
    data: { label: "Total Activities", value: String(totalActivities), trend: "flat" },
  });
  widgets.push({
    type: "stats_card",
    data: { label: "Completed", value: String(totalCompleted), trend: "flat" },
  });
  widgets.push({
    type: "stats_card",
    data: { label: "Completion Rate", value: `${completionRate}%`, trend: "flat" },
  });
  if (peakPeriod.period) {
    const peakLabel = formatPeriodLabel(peakPeriod.period as string);
    widgets.push({
      type: "stats_card",
      data: { label: "Peak Period", value: `${peakLabel} (${peakPeriod.count})`, trend: "flat" },
    });
  }

  const labels = sorted.map((r) => formatPeriodLabel(String(r.period ?? "")));

  widgets.push({
    type: "chart",
    data: {
      chartType: "bar",
      title: "Activity Timeline",
      labels,
      datasets: [
        {
          label: "Completed",
          data: sorted.map((r) => Number(r.completed_count) || 0),
        },
        {
          label: "In Progress",
          data: sorted.map((r) => Number(r.in_progress_count) || 0),
        },
        {
          label: "Planned",
          data: sorted.map((r) => Number(r.planned_count) || 0),
        },
      ],
    },
  });

  const summary = `${totalActivities} activit${totalActivities !== 1 ? "ies" : "y"} across ${sorted.length} period${sorted.length !== 1 ? "s" : ""}, ${completionRate}% completion rate.`;

  return { summary, widgets, followUpOptionIds: option.follow_up_option_ids };
}

function formatPeriodLabel(period: string): string {
  if (!period) return "Unknown";
  try {
    const d = new Date(period);
    if (isNaN(d.getTime())) return period;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return period;
  }
}

function formatAnalysisNotes(
  sqlResults: SqlResult[],
  option: OptionDefinition
): FormattedResponse {
  const rows = sqlResults.flatMap((r) => r.rows);

  if (rows.length === 0) {
    return {
      summary: "No notes found.",
      widgets: [{ type: "text_response", data: { text: "No notes match the given criteria." } }],
      followUpOptionIds: option.follow_up_option_ids,
    };
  }

  const items = rows.map((note) => ({
    id: note.id,
    content: note.content,
    created_at: note.created_at,
    activity_title: note.activity_title,
    activity_id: note.activity_id,
    activity_status: note.activity_status,
    activity_date: note.activity_date,
    _is_note: true,
  }));

  const columns = [
    { key: "content", label: "Note" },
    { key: "activity_title", label: "Activity" },
    { key: "created_at", label: "Date" },
  ];

  const count = items.length;
  const summary = `Found ${count} note${count !== 1 ? "s" : ""}.`;

  return {
    summary,
    widgets: [{
      type: "data_list",
      data: {
        items,
        columns,
        totalItems: count,
        page: 1,
        pageSize: 20,
      },
    }],
    followUpOptionIds: option.follow_up_option_ids,
  };
}

function formatBookmarkList(
  sqlResults: SqlResult[],
  option: OptionDefinition
): FormattedResponse {
  const rows = sqlResults.flatMap((r) => r.rows);

  if (rows.length === 0) {
    return {
      summary: "You don't have any bookmarks yet.",
      widgets: [{ type: "text_response", data: { text: "No bookmarks saved. Use the bookmark icon on any message to save it for later." } }],
      followUpOptionIds: option.follow_up_option_ids.filter((id) => /\.(add|create)$/.test(id)),
    };
  }

  const entityTypeLabels: Record<string, string> = {
    message: "Message",
    activity: "Activity",
    conversation: "Conversation",
    report: "Report",
  };

  const items = rows.map((row) => {
    const rawType = row.entity_type as string;
    return {
      id: row.id,
      label: (row.label as string) || "Untitled bookmark",
      entity_type: entityTypeLabels[rawType] ?? rawType,
      created_at: row.created_at,
      _entity_type_raw: rawType,
      _entity_id: row.entity_id,
      _conversation_id: row.conversation_id ?? null,
    };
  });

  const columns = [
    { key: "label", label: "Label" },
    { key: "entity_type", label: "Type" },
    { key: "created_at", label: "Saved" },
  ];

  const removeAction = {
    label: "Remove Bookmark",
    icon: "Trash2",
    optionId: "bookmark.remove",
    paramKey: "bookmark_id",
    requiresConfirmation: true,
  };

  const count = items.length;
  const summary = `You have ${count} bookmark${count !== 1 ? "s" : ""}.`;

  return {
    summary,
    widgets: [{
      type: "data_list",
      data: {
        items,
        columns,
        totalItems: count,
        page: 1,
        pageSize: Math.max(count, 20),
      },
      actions: [removeAction],
    }],
    followUpOptionIds: option.follow_up_option_ids,
  };
}

// ────────────────────────────────────────────
// Admin specialized formatters (unique layouts only)
// ────────────────────────────────────────────

function formatAdminOptionView(
  sqlResults: SqlResult[],
  option: OptionDefinition
): FormattedResponse {
  const optionResult = sqlResults.find((r) => r.templateName === "get_option");
  const templatesResult = sqlResults.find((r) => r.templateName === "get_templates");
  const questionsResult = sqlResults.find((r) => r.templateName === "get_questions");

  const optDef = optionResult?.rows[0];
  if (!optDef) {
    return {
      summary: "Option not found.",
      widgets: [{ type: "text_response", data: { text: "The requested option definition could not be found." } }],
      followUpOptionIds: option.follow_up_option_ids,
    };
  }

  const widgets: FormattedResponse["widgets"] = [];

  const optItem = {
    name: optDef.name,
    id: optDef.id,
    category: optDef.category,
    user_types: optDef.user_types,
    is_active: optDef.is_active !== false,
    default_priority: optDef.default_priority ?? "—",
    accepts_files: !!optDef.accepts_files,
    show_in_defaults: !!optDef.show_in_defaults,
  };
  widgets.push({
    type: "data_list",
    data: {
      items: [optItem],
      columns: [
        { key: "name", label: "Name" },
        { key: "category", label: "Category" },
        { key: "user_types", label: "User Types" },
        { key: "is_active", label: "Active" },
        { key: "default_priority", label: "Priority" },
      ],
      totalItems: 1,
      page: 1,
      pageSize: 1,
      _noItemActions: true,
    },
  });

  if (optDef.description) {
    widgets.push({ type: "text_response", data: { text: String(optDef.description) } });
  }

  const templates = templatesResult?.rows ?? [];
  if (templates.length > 0) {
    const templateLines = templates.map((t) => {
      const paramMap = typeof t.param_mapping === "object" && t.param_mapping
        ? Object.entries(t.param_mapping as Record<string, string>).map(([k, v]) => `${k} → ${v}`).join(", ")
        : "—";
      return [
        `**${t.name}** (${t.query_type}, order: ${t.execution_order})`,
        "```sql",
        String(t.sql),
        "```",
        `Params: ${paramMap}`,
      ].join("\n");
    });

    widgets.push({
      type: "text_response",
      data: { text: `### SQL Templates\n\n${templateLines.join("\n\n---\n\n")}` },
    });
  }

  const questions = questionsResult?.rows ?? [];
  if (questions.length > 0) {
    const questionItems = questions.map((q) => {
      const wc = (q.widget_config as Record<string, unknown>) ?? {};
      const widget = (q.inline_widget as string) ?? "text";
      let widget_details = "";
      if (widget === "select" || widget === "visibility_select") {
        const opts = (wc.options as string[] | undefined) ?? [];
        widget_details = opts.length > 0 ? opts.join(", ") : (wc.source as string) ? `source: ${wc.source}` : "";
      } else if (widget === "table") {
        const cols = (wc.columns as Array<{ key: string; label: string }> | undefined) ?? [];
        widget_details = cols.map((c) => c.label).join(" | ");
      } else if (widget === "file_upload") {
        widget_details = (wc.accept as string) ?? "—";
      } else if (widget === "date_picker") {
        widget_details = (wc.defaultToday as boolean) ? "default: today" : "";
      }
      return {
        question_text: q.question_text,
        question_key: q.question_key,
        is_required: q.is_required ? "Yes" : "No",
        inline_widget: widget,
        widget_details: widget_details || "—",
        question_order: q.question_order,
      };
    });

    widgets.push({
      type: "data_list",
      data: {
        items: questionItems,
        columns: [
          { key: "question_text", label: "Question" },
          { key: "question_key", label: "Key" },
          { key: "is_required", label: "Required" },
          { key: "inline_widget", label: "Widget" },
          { key: "widget_details", label: "Options/Config" },
        ],
        totalItems: questionItems.length,
        page: 1,
        pageSize: 50,
        _noItemActions: true,
        _noPin: true,
      },
    });
  }

  const followUps = Array.isArray(optDef.follow_up_option_ids) ? optDef.follow_up_option_ids as string[] : [];
  if (followUps.length > 0) {
    widgets.push({ type: "text_response", data: { text: "### Follow-up Options" } });
    widgets.push({
      type: "data_list",
      data: {
        items: followUps.map((id) => ({ id, name: id })),
        columns: [{ key: "name", label: "Option ID" }],
        totalItems: followUps.length,
        page: 1,
        pageSize: 50,
        viewOptionId: "admin.option.view",
        viewParamKey: "option_id",
        _noItemActions: true,
        _noPin: true,
      },
    });
  }

  return {
    summary: `Option: ${optDef.name} (${optDef.category}) — ${templates.length} template${templates.length !== 1 ? "s" : ""}, ${questions.length} question${questions.length !== 1 ? "s" : ""}.`,
    widgets,
    followUpOptionIds: option.follow_up_option_ids,
  };
}

function formatAdminConversationView(
  sqlResults: SqlResult[],
  option: OptionDefinition
): FormattedResponse {
  const messagesResult = sqlResults.find((r) => r.templateName === "get_conversation_messages");
  const messages = messagesResult?.rows ?? [];

  if (messages.length === 0) {
    return {
      summary: "No messages found in this conversation.",
      widgets: [{ type: "text_response", data: { text: "This conversation has no messages, or could not be found." } }],
      followUpOptionIds: option.follow_up_option_ids,
    };
  }

  const userEmail = messages[0]?.user_email as string | undefined;
  const displayName = messages[0]?.display_name as string | undefined;
  const headerParts: string[] = [];
  if (displayName) headerParts.push(`**${displayName}**`);
  if (userEmail) headerParts.push(`(${userEmail})`);
  headerParts.push(`— ${messages.length} message${messages.length !== 1 ? "s" : ""}`);

  const widgets: FormattedResponse["widgets"] = [];

  widgets.push({
    type: "text_response",
    data: { text: `### Conversation Thread\n${headerParts.join(" ")}` },
  });

  const threadLines: string[] = [];
  for (const msg of messages) {
    const role = msg.role as string;
    const content = (msg.content as string) ?? "";
    const createdAt = msg.created_at as string;
    const traceId = msg.trace_id as string | undefined;
    const optId = msg.option_id as string | undefined;
    const dateStr = createdAt ? new Date(createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";

    const sender = role === "user" ? `**User** ${dateStr}` : role === "assistant" ? `**Assistant** ${dateStr}` : `**System** ${dateStr}`;
    const meta: string[] = [];
    if (optId) meta.push(`option: \`${optId}\``);
    if (traceId) meta.push(`trace: \`${traceId}\``);

    threadLines.push(`${sender}${meta.length > 0 ? ` _(${meta.join(", ")})_` : ""}`);
    threadLines.push(content.length > 500 ? content.slice(0, 500) + "..." : content);
    threadLines.push("");
  }

  widgets.push({
    type: "text_response",
    data: { text: threadLines.join("\n") },
  });

  return {
    summary: `Conversation with ${displayName ?? userEmail ?? "user"}: ${messages.length} messages.`,
    widgets,
    followUpOptionIds: option.follow_up_option_ids,
  };
}

function formatAdminTraceLookup(
  sqlResults: SqlResult[],
  option: OptionDefinition,
  params?: Record<string, unknown>
): FormattedResponse {
  const traceLogsResult = sqlResults.find((r) => r.templateName === "trace_logs");
  if (traceLogsResult) {
    const rows = traceLogsResult.rows;
    const errorRow = rows[0] as Record<string, unknown> | undefined;
    if (errorRow?.error) {
      return {
        summary: String(errorRow.error),
        widgets: [{ type: "text_response", data: { text: String(errorRow.error) } }],
        followUpOptionIds: option.follow_up_option_ids,
      };
    }
    const traceId = (params?.trace_id as string) ?? "";
    const logLines = rows.map((r) => {
      const rec = r as Record<string, unknown>;
      return `**${rec.timestamp ?? ""}** [${rec.level ?? ""}] ${rec.service ?? ""}: ${rec.message ?? ""}`;
    });
    return {
      summary: `Found ${rows.length} log entries for trace \`${traceId}\`.`,
      widgets: [
        { type: "text_response", data: { text: `### Trace: \`${traceId}\`\n\n${rows.length} log entries from CloudWatch.` } },
        {
          type: "data_list",
          data: {
            items: rows,
            columns: [
              { key: "timestamp", label: "Time" },
              { key: "level", label: "Level" },
              { key: "service", label: "Service" },
              { key: "message", label: "Message" },
            ],
          },
        },
      ],
      followUpOptionIds: option.follow_up_option_ids,
    };
  }

  const traceResult = sqlResults.find((r) => r.templateName === "lookup_trace");
  const msg = traceResult?.rows[0];

  if (!msg) {
    return {
      summary: "No message found with that trace ID.",
      widgets: [{ type: "text_response", data: { text: "No message found matching the given trace ID. Double-check the ID and try again." } }],
      followUpOptionIds: option.follow_up_option_ids,
    };
  }

  const widgets: FormattedResponse["widgets"] = [];

  const traceId = msg.trace_id as string;
  const role = msg.role as string;
  const content = (msg.content as string) ?? "";
  const userEmail = msg.user_email as string | undefined;
  const displayName = msg.display_name as string | undefined;
  const userType = msg.user_type as string | undefined;
  const tenantName = msg.tenant_name as string | undefined;
  const conversationTitle = msg.conversation_title as string | undefined;
  const conversationId = msg.conversation_id as string | undefined;
  const optionId = msg.option_id as string | undefined;
  const createdAt = msg.created_at as string;

  const dateStr = createdAt ? new Date(createdAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "—";

  const traceItem = {
    display_name: displayName ?? "—",
    email: userEmail ?? "—",
    user_type: userType ?? "—",
    tenant_name: tenantName ?? "—",
    conversation_title: conversationTitle ?? "—",
    option_id: optionId ?? "—",
    role,
    created_at: createdAt,
  };
  widgets.push({
    type: "text_response",
    data: { text: `### Trace: \`${traceId}\`` },
  });
  widgets.push({
    type: "data_list",
    data: {
      items: [traceItem],
      columns: [
        { key: "display_name", label: "User" },
        { key: "email", label: "Email" },
        { key: "user_type", label: "Type" },
        { key: "tenant_name", label: "Tenant" },
        { key: "option_id", label: "Option" },
        { key: "role", label: "Role" },
      ],
      totalItems: 1,
      page: 1,
      pageSize: 1,
    },
  });

  if (content) {
    widgets.push({
      type: "text_response",
      data: { text: `### Message Content\n\n${content.length > 2000 ? content.slice(0, 2000) + "\n\n_(truncated)_" : content}` },
    });
  }

  const metadata = msg.metadata as Record<string, unknown> | null;
  if (metadata && Object.keys(metadata).length > 0) {
    const debugTrace = metadata.debugTrace ?? metadata.debug_trace;
    if (debugTrace && typeof debugTrace === "object") {
      const steps = (debugTrace as Record<string, unknown>).steps;
      if (Array.isArray(steps) && steps.length > 0) {
        const stepLines = steps.map((s: Record<string, unknown>, i: number) => {
          const name = s.name ?? s.step ?? `Step ${i + 1}`;
          const dur = s.durationMs ?? s.duration_ms;
          const durStr = dur != null ? ` (${dur}ms)` : "";
          return `${i + 1}. **${name}**${durStr}`;
        });
        widgets.push({
          type: "text_response",
          data: { text: `### Pipeline Trace\n\n${stepLines.join("\n")}` },
        });
      }
    }
  }

  const followUpParams: Record<string, unknown> = {};
  if (conversationId) followUpParams.conversation_id = conversationId;

  return {
    summary: `Trace ${traceId}: ${role} message from ${displayName ?? userEmail ?? "unknown"} at ${dateStr}.`,
    widgets,
    followUpOptionIds: option.follow_up_option_ids,
  };
}

function formatAdminTenantView(
  sqlResults: SqlResult[],
  option: OptionDefinition
): FormattedResponse {
  const tenantResult = sqlResults.find((r) => r.templateName === "get_tenant");
  const usersResult = sqlResults.find((r) => r.templateName === "get_tenant_users");
  const flagsResult = sqlResults.find((r) => r.templateName === "get_tenant_flags");

  const tenant = tenantResult?.rows[0];
  if (!tenant) {
    return {
      summary: "Tenant not found.",
      widgets: [{ type: "text_response", data: { text: "The requested tenant could not be found." } }],
      followUpOptionIds: option.follow_up_option_ids,
    };
  }

  const widgets: FormattedResponse["widgets"] = [];

  const createdStr = tenant.created_at
    ? new Date(tenant.created_at as string).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "—";

  const detailItems = [
    { name: tenant.name as string, subscription: tenant.subscription ?? "—", slug: tenant.slug, user_count: Number(tenant.user_count ?? 0), custom_domain: tenant.custom_domain ?? null, created_at: tenant.created_at },
  ];
  widgets.push({
    type: "data_list",
    data: {
      items: detailItems,
      columns: [
        { key: "name", label: "Name" },
        { key: "subscription", label: "Subscription" },
        { key: "slug", label: "Slug" },
        { key: "user_count", label: "Users" },
      ],
      totalItems: 1,
      page: 1,
      pageSize: 1,
    },
  });

  if (tenant.custom_domain) {
    widgets.push({
      type: "stats_card",
      data: { label: "Custom Domain", value: String(tenant.custom_domain), trend: "flat" },
    });
  }
  widgets.push({
    type: "stats_card",
    data: { label: "Created", value: createdStr, trend: "flat" },
  });

  const users = usersResult?.rows ?? [];
  if (users.length > 0) {
    widgets.push({
      type: "data_list",
      data: {
        items: users,
        columns: [
          { key: "display_name", label: "Name" },
          { key: "email", label: "Email" },
          { key: "user_type", label: "Type" },
          { key: "created_at", label: "Joined" },
        ],
        totalItems: users.length,
        page: 1,
        pageSize: 50,
        viewOptionId: "admin.user.view",
        viewParamKey: "user_id",
        editOptionId: "admin.user.edit",
        editParamKey: "user_id",
      },
    });
  } else {
    widgets.push({
      type: "text_response",
      data: { text: "No users provisioned for this tenant yet." },
    });
  }

  const flags = flagsResult?.rows ?? [];
  if (flags.length > 0) {
    const flagItems = flags.map((f) => ({
      name: humanLabel(f.flag_key as string),
      enabled: f.enabled,
      flag_key: f.flag_key,
    }));
    widgets.push({
      type: "data_list",
      data: {
        items: flagItems,
        columns: [
          { key: "name", label: "Feature Flag" },
          { key: "enabled", label: "Enabled" },
        ],
        totalItems: flagItems.length,
        page: 1,
        pageSize: 50,
      },
    });
  }

  return {
    summary: `${tenant.name}: ${tenant.subscription} tier, ${users.length} user${users.length !== 1 ? "s" : ""}.`,
    widgets,
    followUpOptionIds: option.follow_up_option_ids,
  };
}

function formatAdminUserView(
  sqlResults: SqlResult[],
  option: OptionDefinition
): FormattedResponse {
  const userResult = sqlResults.find((r) => r.templateName === "get_user");
  const statsResult = sqlResults.find((r) => r.templateName === "get_user_activity_stats");

  const user = userResult?.rows[0];
  if (!user) {
    return {
      summary: "User not found.",
      widgets: [{ type: "text_response", data: { text: "The requested user could not be found." } }],
      followUpOptionIds: option.follow_up_option_ids,
    };
  }

  const widgets: FormattedResponse["widgets"] = [];

  const userItem = {
    display_name: user.display_name,
    email: user.email,
    user_type: user.user_type,
    tenant_name: user.tenant_name ?? "—",
    access_code: user.access_code ?? "—",
    created_at: user.created_at,
    deleted_at: user.deleted_at,
  };
  widgets.push({
    type: "data_list",
    data: {
      items: [userItem],
      columns: [
        { key: "display_name", label: "Name" },
        { key: "email", label: "Email" },
        { key: "user_type", label: "Type" },
        { key: "tenant_name", label: "Tenant" },
        { key: "access_code", label: "Access Code" },
      ],
      totalItems: 1,
      page: 1,
      pageSize: 1,
      editOptionId: "admin.user.edit",
      editParamKey: "user_id",
    },
  });

  const stats = statsResult?.rows[0];
  if (stats) {
    const total = Number(stats.total_activities) || 0;
    if (total > 0) {
      widgets.push({
        type: "stats_card",
        data: { label: "Total Activities", value: String(total), trend: "flat" },
      });
      widgets.push({
        type: "stats_card",
        data: { label: "Completed", value: String(stats.completed ?? 0), trend: "flat" },
      });
      widgets.push({
        type: "stats_card",
        data: { label: "In Progress", value: String(stats.in_progress ?? 0), trend: "flat" },
      });
    } else {
      widgets.push({
        type: "text_response",
        data: { text: "No activities recorded for this user." },
      });
    }
  }

  return {
    summary: `${user.display_name} (${user.user_type}) — ${user.tenant_name ?? "unknown tenant"}.`,
    widgets,
    followUpOptionIds: option.follow_up_option_ids,
  };
}
