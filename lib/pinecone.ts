import { Pinecone } from "@pinecone-database/pinecone";

// Initialize Pinecone client
const apiKey = process.env.PINECONE_API_KEY;
if (!apiKey) {
  throw new Error("PINECONE_API_KEY environment variable is not set");
}

export const pinecone = new Pinecone({ apiKey });

// Index configuration
export const SLACK_INDEX_NAME = "slack-dev";
export const SLACK_TEXT_FIELD = "text"; // Must match the fieldMap in index config

// Types for Slack message records
export interface SlackMessageRecord {
  _id: string;
  text: string;
  // Metadata fields (flat structure required by Pinecone)
  channel_id: string;
  channel_name: string;
  user_id: string;
  user_name: string;
  timestamp: string;
  timestamp_unix: number; // Unix epoch in seconds for numeric filtering
  message_ts: string;
  thread_ts?: string;
  reply_count: number;
  is_thread: boolean;
  organization_id: string;
}

export interface SlackSearchResult {
  id: string;
  score: number;
  text: string;
  channelId: string;
  channelName: string;
  userId: string;
  userName: string;
  timestamp: string;
  messageTs: string;
  threadTs?: string;
  replyCount: number;
  isThread: boolean;
  slackLink: string;
}

/**
 * Get the namespace for an organization
 * Clerk org IDs already start with "org_", so we use them directly
 */
export function getOrganizationNamespace(organizationId: string): string {
  return organizationId;
}

/**
 * Construct a Slack deep link URL for a message
 */
export function constructSlackLink(channelId: string, messageTs: string): string {
  // Slack uses the message timestamp without the dot for deep links
  const tsWithoutDot = messageTs.replace(".", "");
  return `https://slack.com/archives/${channelId}/p${tsWithoutDot}`;
}

/**
 * Generate a unique record ID for a Slack message
 */
export function generateRecordId(channelId: string, ts: string): string {
  return `msg_${channelId}_${ts}`;
}

/**
 * Batch upsert Slack messages to Pinecone
 * Respects the 96 record limit per batch for text records
 */
export async function upsertSlackMessages(
  organizationId: string,
  records: SlackMessageRecord[]
): Promise<{ upsertedCount: number }> {
  const index = pinecone.index(SLACK_INDEX_NAME);
  const namespace = getOrganizationNamespace(organizationId);
  
  const BATCH_SIZE = 96; // Max batch size for text records
  let totalUpserted = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    
    // Convert to the format expected by Pinecone
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await index.namespace(namespace).upsertRecords(batch as any);
    totalUpserted += batch.length;
    
    // Small delay between batches to avoid rate limiting
    if (i + BATCH_SIZE < records.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return { upsertedCount: totalUpserted };
}

/**
 * Search Slack messages in Pinecone with reranking
 */
export async function searchSlackMessages(
  organizationId: string,
  query: string,
  options?: {
    topK?: number;
    channelId?: string;
    channelName?: string;
    startDate?: string; // ISO date string e.g. "2026-01-06"
    endDate?: string;   // ISO date string e.g. "2026-01-12"
  }
): Promise<SlackSearchResult[]> {
  const index = pinecone.index(SLACK_INDEX_NAME);
  const namespace = getOrganizationNamespace(organizationId);
  
  const topK = options?.topK ?? 10;
  
  // Build query options
  const queryOptions: {
    topK: number;
    inputs: { text: string };
    filter?: Record<string, unknown>;
  } = {
    topK: topK * 2, // Get more candidates for reranking
    inputs: { text: query },
  };

  // Build filter conditions
  const filterConditions: Record<string, unknown>[] = [];

  // Add channel filter if specified (by ID or name)
  if (options?.channelId) {
    filterConditions.push({ channel_id: { $eq: options.channelId } });
  }
  if (options?.channelName) {
    filterConditions.push({ channel_name: { $eq: options.channelName } });
  }

  // Add time range filters (using numeric timestamp_unix for Pinecone filtering)
  if (options?.startDate) {
    const startUnix = Math.floor(new Date(options.startDate).getTime() / 1000);
    filterConditions.push({ timestamp_unix: { $gte: startUnix } });
  }
  if (options?.endDate) {
    // Add one day to end date to include the entire day
    const endDatePlusOne = new Date(options.endDate);
    endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);
    const endUnix = Math.floor(endDatePlusOne.getTime() / 1000);
    filterConditions.push({ timestamp_unix: { $lt: endUnix } });
  }

  // Combine filters with $and if multiple conditions
  if (filterConditions.length === 1) {
    queryOptions.filter = filterConditions[0];
  } else if (filterConditions.length > 1) {
    queryOptions.filter = { $and: filterConditions };
  }

  // Search with reranking for better results
  const results = await index.namespace(namespace).searchRecords({
    query: queryOptions,
    rerank: {
      model: "bge-reranker-v2-m3",
      topN: topK,
      rankFields: [SLACK_TEXT_FIELD],
    },
    fields: [
      SLACK_TEXT_FIELD,
      "channel_id",
      "channel_name",
      "user_id",
      "user_name",
      "timestamp",
      "message_ts",
      "thread_ts",
      "reply_count",
      "is_thread",
    ],
  });

  // Transform results
  return results.result.hits.map((hit) => {
    const fields = hit.fields as Record<string, unknown>;
    const channelId = String(fields?.channel_id ?? "");
    const messageTs = String(fields?.message_ts ?? "");
    
    return {
      id: hit._id,
      score: hit._score,
      text: String(fields?.[SLACK_TEXT_FIELD] ?? ""),
      channelId,
      channelName: String(fields?.channel_name ?? ""),
      userId: String(fields?.user_id ?? ""),
      userName: String(fields?.user_name ?? ""),
      timestamp: String(fields?.timestamp ?? ""),
      messageTs,
      threadTs: fields?.thread_ts ? String(fields.thread_ts) : undefined,
      replyCount: Number(fields?.reply_count ?? 0),
      isThread: Boolean(fields?.is_thread),
      slackLink: constructSlackLink(channelId, messageTs),
    };
  });
}

/**
 * Delete all records for a specific channel from Pinecone
 */
export async function deleteChannelRecords(
  organizationId: string,
  channelId: string
): Promise<void> {
  const index = pinecone.index(SLACK_INDEX_NAME);
  const namespace = getOrganizationNamespace(organizationId);
  
  // List all record IDs with the channel prefix
  const prefix = `msg_${channelId}_`;
  const allIds: string[] = [];
  let paginationToken: string | undefined;

  // Paginate through all records (Pinecone limit is max 100 per request)
  while (true) {
    const result = await index.namespace(namespace).listPaginated({
      prefix,
      limit: 100,
      paginationToken,
    });

    if (result.vectors) {
      allIds.push(...result.vectors.map((v) => v.id).filter((id): id is string => id !== undefined));
    }

    if (!result.pagination?.next) {
      break;
    }
    paginationToken = result.pagination.next;
  }

  // Delete in batches
  if (allIds.length > 0) {
    const DELETE_BATCH_SIZE = 1000;
    for (let i = 0; i < allIds.length; i += DELETE_BATCH_SIZE) {
      const batch = allIds.slice(i, i + DELETE_BATCH_SIZE);
      await index.namespace(namespace).deleteMany(batch);
    }
  }
}

/**
 * Get stats for the Slack index namespace
 */
export async function getNamespaceStats(organizationId: string): Promise<{
  recordCount: number;
}> {
  const index = pinecone.index(SLACK_INDEX_NAME);
  const namespace = getOrganizationNamespace(organizationId);
  
  const stats = await index.describeIndexStats();
  const namespaceStats = stats.namespaces?.[namespace];
  
  return {
    recordCount: namespaceStats?.recordCount ?? 0,
  };
}

