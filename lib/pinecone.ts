import { Pinecone } from "@pinecone-database/pinecone";

// Initialize Pinecone client
const apiKey = process.env.PINECONE_API_KEY;
if (!apiKey) {
  throw new Error("PINECONE_API_KEY environment variable is not set");
}

export const pinecone = new Pinecone({ apiKey });

// Index configuration - using same index for all company brain sources
export const COMPANY_BRAIN_INDEX_NAME = "slack-dev";
export const SLACK_INDEX_NAME = COMPANY_BRAIN_INDEX_NAME; // Alias for backwards compatibility
export const TEXT_FIELD = "text"; // Must match the fieldMap in index config
export const SLACK_TEXT_FIELD = TEXT_FIELD; // Alias for backwards compatibility

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

// =============================================================================
// TLDV Meeting Records
// =============================================================================

export type TldvRecordType = "meeting_meta" | "transcript";

// Base interface for all tldv records
interface TldvBaseRecord {
  _id: string;
  text: string;
  meeting_id: string;
  meeting_title: string;
  source_type: "tldv";
  record_type: TldvRecordType;
  timestamp_unix: number;
  organization_id: string;
}

// Meeting metadata record
export interface TldvMeetingMetaRecord extends TldvBaseRecord {
  record_type: "meeting_meta";
  tldv_url: string;
}

// Transcript chunk record
export interface TldvTranscriptRecord extends TldvBaseRecord {
  record_type: "transcript";
  speaker: string;
  start_time: number;
  end_time: number;
}

export type TldvRecord = TldvMeetingMetaRecord | TldvTranscriptRecord;

export interface TldvSearchResult {
  id: string;
  score: number;
  text: string;
  meetingId: string;
  meetingTitle: string;
  sourceType: "tldv";
  recordType: TldvRecordType;
  timestamp: string;
  tldvUrl?: string;
  speaker?: string;
  startTime?: number;
  endTime?: number;
}

/**
 * Generate a unique record ID for a tldv meeting metadata record
 */
export function generateTldvMetaRecordId(meetingId: string): string {
  return `tldv_${meetingId}_meta`;
}

/**
 * Generate a unique record ID for a tldv transcript chunk
 */
export function generateTldvTranscriptRecordId(
  meetingId: string,
  startTime: number,
  chunkIndex: number
): string {
  return `tldv_${meetingId}_${startTime}_${chunkIndex}`;
}

/**
 * Batch upsert tldv records to Pinecone
 * Respects the 96 record limit per batch for text records
 */
export async function upsertTldvRecords(
  organizationId: string,
  records: TldvRecord[]
): Promise<{ upsertedCount: number }> {
  const index = pinecone.index(COMPANY_BRAIN_INDEX_NAME);
  const namespace = getOrganizationNamespace(organizationId);
  
  const BATCH_SIZE = 96; // Max batch size for text records
  let totalUpserted = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    
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
 * Delete all records for a specific tldv meeting from Pinecone
 */
export async function deleteTldvMeetingRecords(
  organizationId: string,
  meetingId: string
): Promise<void> {
  const index = pinecone.index(COMPANY_BRAIN_INDEX_NAME);
  const namespace = getOrganizationNamespace(organizationId);
  
  // List all record IDs with the meeting prefix
  const prefix = `tldv_${meetingId}_`;
  const allIds: string[] = [];
  let paginationToken: string | undefined;

  // Paginate through all records
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

// =============================================================================
// Unified Company Brain Search
// =============================================================================

export type SourceType = "slack" | "tldv";

export interface CompanyBrainSearchResult {
  id: string;
  score: number;
  text: string;
  sourceType: SourceType;
  timestamp: string;
  // Slack-specific fields
  channelId?: string;
  channelName?: string;
  userId?: string;
  userName?: string;
  messageTs?: string;
  threadTs?: string;
  replyCount?: number;
  isThread?: boolean;
  slackLink?: string;
  // Tldv-specific fields
  meetingId?: string;
  meetingTitle?: string;
  recordType?: TldvRecordType;
  tldvUrl?: string;
  speaker?: string;
  startTime?: number;
  endTime?: number;
}

/**
 * Search all company brain sources (Slack + tldv) in Pinecone with reranking
 */
export async function searchCompanyBrain(
  organizationId: string,
  query: string,
  options?: {
    topK?: number;
    sourceType?: SourceType; // Filter by source type
    startDate?: string;
    endDate?: string;
  }
): Promise<CompanyBrainSearchResult[]> {
  const index = pinecone.index(COMPANY_BRAIN_INDEX_NAME);
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

  // Filter by source type if specified
  if (options?.sourceType) {
    filterConditions.push({ source_type: { $eq: options.sourceType } });
  }

  // Add time range filters
  if (options?.startDate) {
    const startUnix = Math.floor(new Date(options.startDate).getTime() / 1000);
    filterConditions.push({ timestamp_unix: { $gte: startUnix } });
  }
  if (options?.endDate) {
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
      rankFields: [TEXT_FIELD],
    },
    fields: [
      TEXT_FIELD,
      "source_type",
      "timestamp",
      "timestamp_unix",
      // Slack fields
      "channel_id",
      "channel_name",
      "user_id",
      "user_name",
      "message_ts",
      "thread_ts",
      "reply_count",
      "is_thread",
      // Tldv fields
      "meeting_id",
      "meeting_title",
      "record_type",
      "tldv_url",
      "speaker",
      "start_time",
      "end_time",
    ],
  });

  // Transform results
  return results.result.hits.map((hit) => {
    const fields = hit.fields as Record<string, unknown>;
    const sourceType = (fields?.source_type as SourceType) || "slack"; // Default to slack for backwards compatibility
    
    const baseResult: CompanyBrainSearchResult = {
      id: hit._id,
      score: hit._score,
      text: String(fields?.[TEXT_FIELD] ?? ""),
      sourceType,
      timestamp: String(fields?.timestamp ?? ""),
    };

    if (sourceType === "slack") {
      const channelId = String(fields?.channel_id ?? "");
      const messageTs = String(fields?.message_ts ?? "");
      
      return {
        ...baseResult,
        channelId,
        channelName: String(fields?.channel_name ?? ""),
        userId: String(fields?.user_id ?? ""),
        userName: String(fields?.user_name ?? ""),
        messageTs,
        threadTs: fields?.thread_ts ? String(fields.thread_ts) : undefined,
        replyCount: Number(fields?.reply_count ?? 0),
        isThread: Boolean(fields?.is_thread),
        slackLink: constructSlackLink(channelId, messageTs),
      };
    } else if (sourceType === "tldv") {
      return {
        ...baseResult,
        meetingId: String(fields?.meeting_id ?? ""),
        meetingTitle: String(fields?.meeting_title ?? ""),
        recordType: (fields?.record_type as TldvRecordType) || "transcript",
        tldvUrl: fields?.tldv_url ? String(fields.tldv_url) : undefined,
        speaker: fields?.speaker ? String(fields.speaker) : undefined,
        startTime: fields?.start_time ? Number(fields.start_time) : undefined,
        endTime: fields?.end_time ? Number(fields.end_time) : undefined,
      };
    }

    return baseResult;
  });
}

