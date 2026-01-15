import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  upsertSlackMessages,
  generateRecordId,
  SlackMessageRecord,
  upsertTldvRecords,
  generateTldvMetaRecordId,
  generateTldvTranscriptRecordId,
  TldvMeetingMetaRecord,
  TldvTranscriptRecord,
  TldvRecord,
} from "@/lib/pinecone";
import {
  fetchMeetingMetadata,
  fetchTranscript,
  chunkTranscript,
  formatMeetingMetadataText,
  constructTldvUrl,
} from "@/lib/tldv";

/**
 * POST /api/company-brain/inbox/[id]/approve
 * Approve an inbox item and insert its content into Pinecone
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { orgId, userId } = await auth();

    if (!orgId) {
      return NextResponse.json(
        { error: "Unauthorized - no organization selected" },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Get the inbox item
    const { data: item, error: itemError } = await supabaseAdmin
      .from("inbox_items")
      .select("*")
      .eq("id", id)
      .eq("organization_id", orgId)
      .single();

    if (itemError || !item) {
      return NextResponse.json(
        { error: "Inbox item not found" },
        { status: 404 }
      );
    }

    if (item.status !== "pending") {
      return NextResponse.json(
        { error: "Item has already been processed" },
        { status: 400 }
      );
    }

    let stats: { recordsUpserted: number } = { recordsUpserted: 0 };

    if (item.type === "topic") {
      stats = await approveTopicItem(orgId, item);
    } else if (item.type === "meeting") {
      stats = await approveMeetingItem(orgId, item);
    }

    // Update inbox item status
    await supabaseAdmin
      .from("inbox_items")
      .update({
        status: "approved",
        processed_at: new Date().toISOString(),
        processed_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("Error approving inbox item:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

async function approveTopicItem(
  orgId: string,
  item: {
    topic_id: string | null;
    source_data: {
      channelId?: string;
      channelName?: string;
      messageTs?: string;
      threadTs?: string;
      isThread?: boolean;
      messages?: Array<{
        userName: string;
        text: string;
        timestamp: string;
      }>;
    };
  }
): Promise<{ recordsUpserted: number }> {
  const sourceData = item.source_data || {};
  const messages = sourceData.messages || [];

  if (messages.length === 0) {
    return { recordsUpserted: 0 };
  }

  const channelId = sourceData.channelId || "";
  const channelName = sourceData.channelName || channelId;
  const messageTs = sourceData.messageTs || "";
  const threadTs = sourceData.threadTs;
  const isThread = sourceData.isThread || false;

  // For threads, combine all messages into one record
  // For single messages, create one record
  if (isThread && messages.length > 1) {
    // Combine thread messages into single record
    const combinedText = messages
      .map((m) => `[${m.userName}]: ${m.text}`)
      .join("\n\n");

    const firstTimestamp = messages[0].timestamp;
    const timestampSeconds = new Date(firstTimestamp).getTime() / 1000;

    const record: SlackMessageRecord = {
      _id: generateRecordId(channelId, threadTs || messageTs),
      text: combinedText,
      channel_id: channelId,
      channel_name: channelName,
      user_id: "", // Not tracking individual user for threads
      user_name: messages[0].userName,
      timestamp: firstTimestamp,
      timestamp_unix: Math.floor(timestampSeconds),
      message_ts: messageTs,
      thread_ts: threadTs,
      reply_count: messages.length - 1,
      is_thread: true,
      organization_id: orgId,
    };

    const { upsertedCount } = await upsertSlackMessages(orgId, [record]);
    return { recordsUpserted: upsertedCount };
  } else {
    // Single message
    const msg = messages[0];
    const timestampSeconds = new Date(msg.timestamp).getTime() / 1000;

    const record: SlackMessageRecord = {
      _id: generateRecordId(channelId, messageTs),
      text: msg.text,
      channel_id: channelId,
      channel_name: channelName,
      user_id: "",
      user_name: msg.userName,
      timestamp: msg.timestamp,
      timestamp_unix: Math.floor(timestampSeconds),
      message_ts: messageTs,
      thread_ts: threadTs,
      reply_count: 0,
      is_thread: false,
      organization_id: orgId,
    };

    const { upsertedCount } = await upsertSlackMessages(orgId, [record]);
    return { recordsUpserted: upsertedCount };
  }
}

async function approveMeetingItem(
  orgId: string,
  item: {
    meeting_id: string | null;
    tldv_url: string | null;
    title: string;
    source_data: {
      meetingId?: string;
      meetingTitle?: string;
      happenedAt?: string;
      duration?: number;
      participants?: string[];
      organizerEmail?: string;
      organizerName?: string;
      invitees?: Array<{ name: string; email: string }>;
    };
  }
): Promise<{ recordsUpserted: number }> {
  const meetingId = item.meeting_id || item.source_data?.meetingId;
  if (!meetingId) {
    throw new Error("Meeting ID missing from inbox item");
  }

  // Fetch fresh data from tldv
  const [metadata, transcript] = await Promise.all([
    fetchMeetingMetadata(meetingId),
    fetchTranscript(meetingId),
  ]);

  const timestampUnix = Math.floor(new Date(metadata.happenedAt).getTime() / 1000);
  const tldvUrl = constructTldvUrl(meetingId);

  // Create meeting metadata record
  const metadataRecord: TldvMeetingMetaRecord = {
    _id: generateTldvMetaRecordId(meetingId),
    text: formatMeetingMetadataText(metadata),
    meeting_id: meetingId,
    meeting_title: metadata.name,
    source_type: "tldv",
    record_type: "meeting_meta",
    timestamp_unix: timestampUnix,
    organization_id: orgId,
    tldv_url: tldvUrl,
  };

  // Chunk transcript and create records
  const chunkedDialogs = chunkTranscript(transcript.data);

  const transcriptRecords: TldvTranscriptRecord[] = chunkedDialogs.map((chunk) => ({
    _id: generateTldvTranscriptRecordId(meetingId, chunk.startTime, chunk.chunkIndex),
    text: chunk.text,
    meeting_id: meetingId,
    meeting_title: metadata.name,
    source_type: "tldv" as const,
    record_type: "transcript" as const,
    timestamp_unix: timestampUnix + chunk.startTime,
    organization_id: orgId,
    speaker: chunk.speaker,
    start_time: chunk.startTime,
    end_time: chunk.endTime,
  }));

  // Combine and upsert
  const allRecords: TldvRecord[] = [metadataRecord, ...transcriptRecords];
  const { upsertedCount } = await upsertTldvRecords(orgId, allRecords);

  // Also store in tldv_meetings table
  await supabaseAdmin.from("tldv_meetings").upsert(
    {
      organization_id: orgId,
      meeting_id: meetingId,
      meeting_title: metadata.name,
      meeting_date: metadata.happenedAt,
      duration_seconds: Math.floor(metadata.duration),
      chunk_count: transcriptRecords.length,
      tldv_url: tldvUrl,
      organizer_name: metadata.organizer?.name || null,
      organizer_email: metadata.organizer?.email || null,
      invitees: metadata.invitees || [],
      conference_id: metadata.extraProperties?.conferenceId || null,
    },
    { onConflict: "organization_id,meeting_id" }
  );

  return { recordsUpserted: upsertedCount };
}

