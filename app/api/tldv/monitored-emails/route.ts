import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  fetchAllMeetings,
  filterMeetingsByEmail,
  fetchTranscript,
  TldvMeetingMetadata,
} from "@/lib/tldv";

export interface MonitoredEmailResponse {
  id: string;
  email: string;
  createdAt: string;
  createdBy: string | null;
}

/**
 * GET /api/tldv/monitored-emails
 * List all monitored emails for the organization
 */
export async function GET() {
  try {
    const { orgId } = await auth();

    if (!orgId) {
      return NextResponse.json(
        { error: "Unauthorized - no organization selected" },
        { status: 401 }
      );
    }

    const { data: emails, error } = await supabaseAdmin
      .from("tldv_monitored_emails")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json(
        { error: "Failed to fetch monitored emails" },
        { status: 500 }
      );
    }

    const response: MonitoredEmailResponse[] = emails.map((email) => ({
      id: email.id,
      email: email.email,
      createdAt: email.created_at,
      createdBy: email.created_by,
    }));

    return NextResponse.json({ emails: response });
  } catch (error) {
    console.error("Error fetching monitored emails:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tldv/monitored-emails
 * Add a new monitored email for the organization
 */
export async function POST(request: Request) {
  try {
    const { orgId, userId } = await auth();

    if (!orgId) {
      return NextResponse.json(
        { error: "Unauthorized - no organization selected" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { email } = body as { email?: string };

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "email is required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Check if email already exists for this org
    const { data: existing } = await supabaseAdmin
      .from("tldv_monitored_emails")
      .select("id")
      .eq("organization_id", orgId)
      .eq("email", email.trim().toLowerCase())
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "Email is already being monitored" },
        { status: 409 }
      );
    }

    // Insert new monitored email
    const { data: newEmail, error: insertError } = await supabaseAdmin
      .from("tldv_monitored_emails")
      .insert({
        organization_id: orgId,
        email: email.trim().toLowerCase(),
        created_by: userId,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Supabase insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to add monitored email" },
        { status: 500 }
      );
    }

    // Trigger initial sync for this email (don't block the response)
    syncMeetingsForEmail(orgId, email.trim().toLowerCase()).catch((err) => {
      console.error("Initial sync error:", err);
    });

    return NextResponse.json({
      success: true,
      email: {
        id: newEmail.id,
        email: newEmail.email,
        createdAt: newEmail.created_at,
        createdBy: newEmail.created_by,
      },
      message: "Email added. Syncing existing meetings to inbox...",
    });
  } catch (error) {
    console.error("Error adding monitored email:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * Sync all meetings for a given email to the inbox
 */
async function syncMeetingsForEmail(orgId: string, email: string) {
  console.log(`[tldv-sync] Starting initial sync for ${email}...`);

  // Fetch all meetings from tldv
  const allMeetings = await fetchAllMeetings(10);

  // Filter by email
  const matchingMeetings = filterMeetingsByEmail(allMeetings, email);
  console.log(`[tldv-sync] Found ${matchingMeetings.length} meetings for ${email}`);

  if (matchingMeetings.length === 0) return;

  // Get already added meetings for this org
  const { data: existingMeetings } = await supabaseAdmin
    .from("tldv_meetings")
    .select("meeting_id")
    .eq("organization_id", orgId);

  const existingMeetingIds = new Set(
    existingMeetings?.map((m) => m.meeting_id) || []
  );

  // Check inbox items to avoid duplicates
  const { data: pendingItems } = await supabaseAdmin
    .from("inbox_items")
    .select("meeting_id")
    .eq("organization_id", orgId)
    .eq("type", "meeting")
    .not("meeting_id", "is", null);

  const pendingMeetingIds = new Set(
    pendingItems?.map((i) => i.meeting_id).filter(Boolean) || []
  );

  let created = 0;

  for (const meeting of matchingMeetings) {
    // Skip if already added or pending
    if (existingMeetingIds.has(meeting.id) || pendingMeetingIds.has(meeting.id)) {
      continue;
    }

    try {
      await createMeetingInboxItem(orgId, meeting);
      created++;
      pendingMeetingIds.add(meeting.id);

      // Delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 300));
    } catch (error) {
      console.error(`[tldv-sync] Error processing meeting ${meeting.id}:`, error);
    }
  }

  console.log(`[tldv-sync] Created ${created} inbox items for ${email}`);
}

/**
 * Create an inbox item for a meeting
 */
async function createMeetingInboxItem(orgId: string, meeting: TldvMeetingMetadata) {
  // Fetch transcript
  let formattedTranscript = "";

  try {
    const transcript = await fetchTranscript(meeting.id);

    if (transcript.data && transcript.data.length > 0) {
      const formattedLines: string[] = [];

      for (const entry of transcript.data) {
        const speakerName = entry.speaker || "Unknown Speaker";
        const startTime = formatTimestamp(entry.startTime);
        const text = entry.text?.trim() || "";

        if (text) {
          formattedLines.push(`**${speakerName}** *(${startTime})*\n${text}`);
        }
      }

      formattedTranscript = formattedLines.join("\n\n---\n\n");
    } else {
      formattedTranscript = "No transcript available for this meeting.";
    }
  } catch (error) {
    console.error(`Failed to fetch transcript for ${meeting.id}:`, error);
    formattedTranscript = "Transcript unavailable.";
  }

  // Get participants
  const participants: string[] = [];
  if (meeting.organizer?.name) {
    participants.push(meeting.organizer.name);
  } else if (meeting.organizer?.email) {
    participants.push(meeting.organizer.email);
  }
  for (const invitee of meeting.invitees || []) {
    if (invitee.name) {
      participants.push(invitee.name);
    } else if (invitee.email) {
      participants.push(invitee.email);
    }
  }

  // Format meeting date
  const meetingDate = new Date(meeting.happenedAt).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const durationMins = Math.round(meeting.duration / 60);

  const summary = `**Date:** ${meetingDate}\n**Duration:** ${durationMins} minutes\n**Participants:** ${participants.join(", ")}\n\n---\n\n### Transcript\n\n${formattedTranscript}`;

  await supabaseAdmin.from("inbox_items").insert({
    organization_id: orgId,
    type: "meeting",
    title: meeting.name,
    summary,
    source_data: {
      meetingId: meeting.id,
      meetingTitle: meeting.name,
      happenedAt: meeting.happenedAt,
      duration: meeting.duration,
      participants,
      organizerEmail: meeting.organizer?.email,
      organizerName: meeting.organizer?.name,
      invitees: meeting.invitees,
      tldvUrl: meeting.url,
    },
    status: "pending",
    meeting_id: meeting.id,
    tldv_url: meeting.url,
  });
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

