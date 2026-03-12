import type { OptionDefinition } from "@/types/options";
import type { SqlResult, FormattedResponse } from "@/types/pipeline";

/**
 * Specialized formatters produce polished output for specific option IDs.
 * Everything else uses the generic deterministic formatter guided by target_widget.
 */
const SPECIALIZED_FORMATTERS: Record<
  string,
  (sqlResults: SqlResult[], option: OptionDefinition) => FormattedResponse
> = {
  "activity.list": formatActivityList,
  "activity.view": formatActivityView,
  "activity.create": formatActivityWriteResult,
  "activity.edit": formatActivityWriteResult,
  "activity.delete": formatActivityDelete,
  "activity.add_note": formatAddNote,
  "activity.add_media": formatAddMedia,
  "view.stats": formatStats,
  "tag.manage": formatTagList,
  "tag.create": formatTagCreate,
  "bookmark.list": formatBookmarkList,
};

export async function formatResponse(
  option: OptionDefinition | null,
  sqlResults: SqlResult[],
  _context: unknown
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
    return specializedFn(sqlResults, option);
  }

  return formatGenericResults(sqlResults, option);
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

function pickDisplayColumns(row: Record<string, unknown>): { key: string; label: string }[] {
  const scalarCols: string[] = [];
  const objectCols: string[] = [];

  for (const k of Object.keys(row)) {
    if (HIDDEN_KEYS.has(k) || k === "id") continue;
    const sample = row[k];
    if (isUuid(sample)) continue;
    if (sample !== null && typeof sample === "object") {
      objectCols.push(k);
    } else {
      scalarCols.push(k);
    }
  }

  return [...scalarCols.slice(0, 8), ...objectCols.slice(0, 3)]
    .map((k) => ({ key: k, label: humanLabel(k) }));
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
  option: OptionDefinition
): FormattedResponse {
  const widgets: FormattedResponse["widgets"] = [];
  let hasWrite = false;
  const targetWidget = option.target_widget;

  for (const result of sqlResults) {
    if (result.queryType === "write") hasWrite = true;
    if (result.rows.length === 0) continue;

    const firstRow = result.rows[0];

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
        widgets.push({
          type: "data_list",
          data: {
            items: result.rows,
            columns,
            totalItems: result.rows.length,
            page: 1,
            pageSize: Math.max(result.rows.length, 10),
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
      widgets: [{ type: "text_response", data: { text: summary } }],
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
  option: OptionDefinition
): FormattedResponse {
  const listResult = sqlResults.find((r) => r.templateName === "list_activities");
  const rows = listResult?.rows ?? [];

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
        totalItems: items.length,
        page: 1,
        pageSize: 10,
      },
    });
  }

  const count = items.length;
  const summary = count === 0
    ? "You don't have any activities yet. Let's add one!"
    : `Here are your ${count} recent activit${count === 1 ? "y" : "ies"}.`;

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
      for (const key of numericKeys) {
        widgets.push({
          type: "stats_card",
          data: { label: humanLabel(key), value: String(firstRow[key]), trend: "flat" },
        });
      }
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

  const summary = widgets.length > 0
    ? "Here's an overview of your activity statistics."
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
