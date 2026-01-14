import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  extractMeetingId,
  fetchMeetingMetadata,
  fetchTranscript,
  chunkTranscript,
  formatMeetingMetadataText,
  constructTldvUrl,
} from "@/lib/tldv";
import {
  upsertTldvRecords,
  generateTldvMetaRecordId,
  generateTldvTranscriptRecordId,
  TldvMeetingMetaRecord,
  TldvTranscriptRecord,
  TldvRecord,
} from "@/lib/pinecone";

export async function POST(request: Request) {
  try {
    const { orgId } = await auth();

    if (!orgId) {
      return NextResponse.json(
        { error: "Unauthorized - no organization selected" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { url } = body as { url?: string };

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "url is required" },
        { status: 400 }
      );
    }

    // Extract meeting ID from URL
    let meetingId: string;
    try {
      meetingId = extractMeetingId(url);
    } catch {
      return NextResponse.json(
        { error: "Invalid tldv URL format" },
        { status: 400 }
      );
    }

    // Check if meeting already exists for this org
    const { data: existing } = await supabaseAdmin
      .from("tldv_meetings")
      .select("id")
      .eq("organization_id", orgId)
      .eq("meeting_id", meetingId)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "Meeting already added to this organization" },
        { status: 409 }
      );
    }

    // Fetch meeting metadata and transcript from tldv API
    const [metadata, transcript] = await Promise.all([
      fetchMeetingMetadata(meetingId),
      fetchTranscript(meetingId),
    ]);

    // Create meeting metadata record for Pinecone
    const timestampUnix = Math.floor(new Date(metadata.happenedAt).getTime() / 1000);
    const tldvUrl = constructTldvUrl(meetingId);

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
      timestamp_unix: timestampUnix + chunk.startTime, // Add dialog offset to meeting start
      organization_id: orgId,
      speaker: chunk.speaker,
      start_time: chunk.startTime,
      end_time: chunk.endTime,
    }));

    // Combine all records and upsert to Pinecone
    const allRecords: TldvRecord[] = [metadataRecord, ...transcriptRecords];
    const { upsertedCount } = await upsertTldvRecords(orgId, allRecords);

    // Store meeting in Supabase
    const { data: meeting, error: insertError } = await supabaseAdmin
      .from("tldv_meetings")
      .insert({
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
      })
      .select()
      .single();

    if (insertError) {
      console.error("Supabase insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to store meeting" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      meeting: {
        id: meeting.id,
        meetingId: meeting.meeting_id,
        title: meeting.meeting_title,
        date: meeting.meeting_date,
        durationSeconds: meeting.duration_seconds,
        chunkCount: meeting.chunk_count,
        tldvUrl: meeting.tldv_url,
      },
      stats: {
        dialogsProcessed: transcript.data.length,
        chunksCreated: transcriptRecords.length,
        recordsUpserted: upsertedCount,
      },
    });
  } catch (error) {
    console.error("Error adding tldv meeting:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

