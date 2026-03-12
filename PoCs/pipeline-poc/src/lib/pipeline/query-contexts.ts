export interface QueryContext {
  id: string;
  label: string;
  icon: string;
  description: string;
  baseSQL: string;
  availableColumns: string[];
  allowedOperations: ("filter" | "sort" | "aggregate" | "count" | "group" | "limit")[];
  paramNotes: string;
}

export const QUERY_CONTEXTS: QueryContext[] = [
  {
    id: "my_activities",
    label: "Your Activities",
    icon: "List",
    description: "Search, filter, or analyze across all your activities",
    baseSQL: `SELECT a.id, a.title, a.description, a.status, a.visibility,
       a.activity_date, a.location, a.is_pinned, a.created_at,
       array_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL) as tag_names,
       count(DISTINCT an.id) as note_count,
       count(DISTINCT am.id) as media_count
FROM activities a
LEFT JOIN activity_tags at2 ON a.id = at2.activity_id
LEFT JOIN tags t ON at2.tag_id = t.id
LEFT JOIN activity_notes an ON a.id = an.activity_id AND an.deleted_at IS NULL
LEFT JOIN activity_media am ON a.id = am.activity_id
WHERE a.tenant_id = $1 AND a.deleted_at IS NULL
GROUP BY a.id`,
    availableColumns: [
      "title", "description", "status", "visibility",
      "activity_date", "location", "is_pinned", "created_at",
      "tag_names", "note_count", "media_count",
    ],
    allowedOperations: ["filter", "sort", "aggregate", "count", "group", "limit"],
    paramNotes: "$1 = tenant_id (always provided). status enum: planned, in_progress, completed, cancelled. visibility enum: private, team, public.",
  },
  {
    id: "specific_activity",
    label: "A Specific Activity",
    icon: "Eye",
    description: "Get details, notes, or media for one activity",
    baseSQL: `SELECT a.id, a.title, a.description, a.status, a.visibility,
       a.activity_date, a.location, a.created_at,
       (SELECT count(*) FROM activity_notes WHERE activity_id = a.id AND deleted_at IS NULL) as note_count,
       (SELECT count(*) FROM activity_media WHERE activity_id = a.id) as media_count
FROM activities a
WHERE a.tenant_id = $1 AND a.deleted_at IS NULL`,
    availableColumns: [
      "title", "description", "status", "visibility",
      "activity_date", "location", "created_at",
      "note_count", "media_count",
    ],
    allowedOperations: ["filter", "sort", "limit"],
    paramNotes: "$1 = tenant_id. Add WHERE conditions like title ILIKE, activity_date range, ORDER BY activity_date DESC LIMIT 1 for 'latest'.",
  },
  {
    id: "tags_breakdown",
    label: "Tags & Categories",
    icon: "Tags",
    description: "Tag usage, distribution, and activity counts per tag",
    baseSQL: `SELECT t.name, t.color, t.source, count(at2.id) as activity_count
FROM tags t
LEFT JOIN activity_tags at2 ON t.id = at2.tag_id
LEFT JOIN activities a ON at2.activity_id = a.id AND a.deleted_at IS NULL AND a.tenant_id = $1
WHERE (t.tenant_id = $1 OR t.tenant_id IS NULL) AND t.is_hidden = false
GROUP BY t.id, t.name, t.color, t.source`,
    availableColumns: ["name", "color", "source", "activity_count"],
    allowedOperations: ["filter", "sort", "aggregate", "count", "limit"],
    paramNotes: "$1 = tenant_id. source is 'system' or 'custom'. Can add HAVING clause for count filters.",
  },
  {
    id: "activity_timeline",
    label: "Activity Timeline",
    icon: "Calendar",
    description: "Trends, patterns, and time-based analysis of activities",
    baseSQL: `SELECT
       date_trunc('week', a.activity_date) as period,
       count(*) as activity_count,
       count(*) FILTER (WHERE a.status = 'completed') as completed_count,
       count(*) FILTER (WHERE a.status = 'planned') as planned_count
FROM activities a
WHERE a.tenant_id = $1 AND a.deleted_at IS NULL AND a.activity_date IS NOT NULL
GROUP BY period`,
    availableColumns: ["period", "activity_count", "completed_count", "planned_count"],
    allowedOperations: ["filter", "sort", "aggregate", "group", "limit"],
    paramNotes: "$1 = tenant_id. Change date_trunc granularity ('day', 'week', 'month'). Can add date range filters.",
  },
  {
    id: "notes_search",
    label: "Activity Notes",
    icon: "MessageSquare",
    description: "Search across all notes and follow-ups",
    baseSQL: `SELECT an.content, an.created_at, a.title as activity_title, a.id as activity_id
FROM activity_notes an
JOIN activities a ON an.activity_id = a.id
WHERE an.tenant_id = $1 AND an.deleted_at IS NULL AND a.deleted_at IS NULL`,
    availableColumns: ["content", "created_at", "activity_title", "activity_id"],
    allowedOperations: ["filter", "sort", "count", "limit"],
    paramNotes: "$1 = tenant_id. Use content ILIKE for text search. Join is already set up.",
  },
];

export function getContextById(id: string): QueryContext | undefined {
  return QUERY_CONTEXTS.find((c) => c.id === id);
}

export interface ContextSuggestion {
  contextId: string;
  relevance: number;
  reason: string;
}
