import type { OptionDefinition } from "@/types/options";
import type { SqlResult, UserContext, FormattedResponse } from "@/types/pipeline";
import { getLLMProvider } from "@/lib/llm/factory";

const DETERMINISTIC_OPTIONS = new Set([
  "activity.list",
  "activity.view",
  "activity.create",
  "activity.edit",
  "activity.delete",
  "activity.add_note",
  "activity.add_media",
  "view.stats",
  "tag.manage",
  "tag.create",
]);

export async function formatResponse(
  option: OptionDefinition | null,
  sqlResults: SqlResult[],
  context: UserContext
): Promise<FormattedResponse> {
  if (option && DETERMINISTIC_OPTIONS.has(option.id)) {
    return formatDeterministic(option, sqlResults);
  }

  const llm = getLLMProvider();

  const responsePrompt = option?.response_prompt ?? "Format the query results clearly for the user.";
  const followUpOptionIds = option?.follow_up_option_ids ?? [];

  const formatted = await llm.formatResponse(
    {
      results: sqlResults.map((r) => ({
        name: r.templateName,
        rows: r.rows,
        rowCount: r.rowCount,
        type: r.queryType,
      })),
    },
    {
      userDisplayName: context.displayName,
      responsePrompt,
      followUpOptionIds,
    }
  );

  return formatted;
}

function formatDeterministic(
  option: OptionDefinition,
  sqlResults: SqlResult[]
): FormattedResponse {
  switch (option.id) {
    case "activity.list":
      return formatActivityList(sqlResults, option);
    case "activity.view":
      return formatActivityView(sqlResults, option);
    case "activity.create":
    case "activity.edit":
      return formatActivityWriteResult(sqlResults, option);
    case "activity.delete":
      return formatActivityDelete(option);
    case "activity.add_note":
      return formatAddNote(sqlResults, option);
    case "activity.add_media":
      return formatAddMedia(sqlResults, option);
    case "view.stats":
      return formatStats(sqlResults, option);
    case "tag.manage":
      return formatTagList(sqlResults, option);
    case "tag.create":
      return formatTagCreate(sqlResults, option);
    default:
      return fallbackFormat(sqlResults, option);
  }
}

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

  return {
    summary,
    widgets,
    followUpOptionIds: option.follow_up_option_ids,
  };
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

  const summary = activity.ai_summary as Record<string, unknown> | null;
  const media = mediaResult?.rows ?? [];
  const notes = notesResult?.rows ?? [];

  const cardData: Record<string, unknown> = {
    ...activity,
    title: summary?.enhancedTitle ?? activity.title,
    description: summary?.enhancedDescription ?? activity.description,
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

function formatActivityDelete(option: OptionDefinition): FormattedResponse {
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

    const isSingleAggregate = result.rows.length === 1
      && Object.values(result.rows[0]).every((v) => typeof v === "number" || typeof v === "bigint");

    if (isSingleAggregate) {
      const row = result.rows[0];
      for (const [key, value] of Object.entries(row)) {
        widgets.push({
          type: "stats_card",
          data: {
            label: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
            value: String(value),
            trend: "flat",
          },
        });
      }
    } else if (result.rows.length >= 1) {
      const firstRow = result.rows[0];
      const labelKey = Object.keys(firstRow).find((k) => typeof firstRow[k] === "string") ?? "name";
      const valueKey = Object.keys(firstRow).find((k) => typeof firstRow[k] === "number") ?? "count";

      widgets.push({
        type: "chart",
        data: {
          chartType: "bar",
          title: result.templateName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          labels: result.rows.map((r) => String(r[labelKey])),
          datasets: [{
            label: valueKey.replace(/_/g, " "),
            data: result.rows.map((r) => Number(r[valueKey]) || 0),
          }],
        },
      });
    }
  }

  const summary = widgets.length > 0
    ? "Here's an overview of your activity statistics."
    : "No statistics available yet. Start adding activities!";

  return {
    summary,
    widgets,
    followUpOptionIds: option.follow_up_option_ids,
  };
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
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "";

  return {
    summary: "Note added successfully.",
    widgets: [
      {
        type: "text_response",
        data: {
          text: `**Note added** ${dateStr ? `on ${dateStr}` : ""}\n\n> ${content}`,
        },
      },
    ],
    followUpOptionIds: option.follow_up_option_ids,
  };
}

function formatAddMedia(
  sqlResults: SqlResult[],
  option: OptionDefinition
): FormattedResponse {
  const count = sqlResults.reduce((sum, r) => sum + r.rowCount, 0);
  return {
    summary: `${count} file${count !== 1 ? "s" : ""} added to the activity.`,
    widgets: [
      {
        type: "text_response",
        data: {
          text: `Successfully attached ${count} file${count !== 1 ? "s" : ""} to the activity.`,
        },
      },
    ],
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
      widgets: [
        { type: "text_response", data: { text: "No tags found yet. Use **Create Tag** to add your own." } },
      ],
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
    widgets: [
      {
        type: "text_response",
        data: {
          text: `Tag **${tag.name}** has been created. You can now use it when adding or editing activities.`,
        },
      },
    ],
    followUpOptionIds: option.follow_up_option_ids,
  };
}

function fallbackFormat(
  sqlResults: SqlResult[],
  option: OptionDefinition
): FormattedResponse {
  const allRows = sqlResults.flatMap((r) => r.rows);
  return {
    summary: "Here are the results.",
    widgets: [{ type: "text_response", data: { text: JSON.stringify(allRows, null, 2) } }],
    followUpOptionIds: option.follow_up_option_ids,
  };
}
