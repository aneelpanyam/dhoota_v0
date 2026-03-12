import {
  CloudWatchLogsClient,
  CreateLogStreamCommand,
  PutLogEventsCommand,
  ResourceAlreadyExistsException,
} from "@aws-sdk/client-cloudwatch-logs";

export interface LogEntry {
  timestamp: number;
  message: string;
}

let client: CloudWatchLogsClient | null = null;
let currentStreamName: string | null = null;

function getClient(): CloudWatchLogsClient {
  if (!client) {
    client = new CloudWatchLogsClient({
      region: process.env.CLOUDWATCH_REGION || process.env.AWS_S3_REGION || "ap-south-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }
  return client;
}

function getLogGroup(): string {
  return process.env.CLOUDWATCH_LOG_GROUP || "/dhoota/pipeline";
}

function getStreamName(): string {
  const today = new Date().toISOString().slice(0, 10);
  if (currentStreamName?.startsWith(today)) return currentStreamName;
  currentStreamName = `${today}-${crypto.randomUUID().slice(0, 8)}`;
  return currentStreamName;
}

async function ensureLogStream(streamName: string): Promise<void> {
  try {
    await getClient().send(
      new CreateLogStreamCommand({
        logGroupName: getLogGroup(),
        logStreamName: streamName,
      })
    );
  } catch (err) {
    if (err instanceof ResourceAlreadyExistsException) return;
    throw err;
  }
}

/**
 * Flush a batch of log entries to CloudWatch Logs.
 * Entries must be sorted by timestamp (ascending).
 * Max 10,000 entries or 1MB per batch (enforced by AWS).
 */
export async function flushToCloudWatch(entries: LogEntry[]): Promise<void> {
  if (entries.length === 0) return;

  const streamName = getStreamName();
  await ensureLogStream(streamName);

  const MAX_BATCH = 10000;
  const sorted = [...entries].sort((a, b) => a.timestamp - b.timestamp);

  for (let i = 0; i < sorted.length; i += MAX_BATCH) {
    const batch = sorted.slice(i, i + MAX_BATCH);
    await getClient().send(
      new PutLogEventsCommand({
        logGroupName: getLogGroup(),
        logStreamName: streamName,
        logEvents: batch.map((e) => ({
          timestamp: e.timestamp,
          message: e.message,
        })),
      })
    );
  }
}
