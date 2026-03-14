import {
  CloudWatchLogsClient,
  FilterLogEventsCommand,
  type FilteredLogEvent,
} from "@aws-sdk/client-cloudwatch-logs";

let client: CloudWatchLogsClient | null = null;

function getClient(): CloudWatchLogsClient {
  if (!client) {
    client = new CloudWatchLogsClient({
      region: process.env.CLOUDWATCH_REGION || process.env.AWS_S3_REGION || "ap-south-1",
      credentials: process.env.AWS_ACCESS_KEY_ID
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
          }
        : undefined,
    });
  }
  return client;
}

function getLogGroup(): string {
  return process.env.CLOUDWATCH_LOG_GROUP || "/dhoota/pipeline";
}

/**
 * Query CloudWatch Logs for entries matching the given trace ID.
 * Returns log messages (parsed when JSON) as an array of records.
 */
export async function queryLogsByTraceId(traceId: string): Promise<Record<string, unknown>[]> {
  const logGroup = getLogGroup();
  const oneDayMs = 24 * 60 * 60 * 1000;
  const endTime = Date.now();
  const startTime = endTime - 7 * oneDayMs; // Search last 7 days

  // Filter pattern: match traceId in JSON message. CloudWatch JSON filter: { $.traceId = "value" }
  const filterPattern = `{ $.traceId = "${traceId}" }`;

  const events: FilteredLogEvent[] = [];
  let nextToken: string | undefined;

  do {
    const response = await getClient().send(
      new FilterLogEventsCommand({
        logGroupName: logGroup,
        startTime,
        endTime,
        filterPattern,
        nextToken,
      })
    );
    events.push(...(response.events ?? []));
    nextToken = response.nextToken;
  } while (nextToken);

  return events.map((e) => {
    try {
      const parsed = JSON.parse(e.message ?? "{}") as Record<string, unknown>;
      return {
        timestamp: e.timestamp ? new Date(e.timestamp).toISOString() : "",
        ...parsed,
      };
    } catch {
      return { timestamp: e.timestamp ? new Date(e.timestamp).toISOString() : "", message: e.message };
    }
  });
}
