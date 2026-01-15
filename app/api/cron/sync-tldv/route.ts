import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  fetchAllMeetings,
  filterMeetingsByEmail,
  fetchTranscript,
  TldvMeetingMetadata,
} from "@/lib/tldv";

// Cron secret for authorization
const CRON_SECRET = process.env.CRON_SECRET;

interface MonitoredEmail {
  id: string;
  organization_id: string;
  email: string;
}

/**
 * GET /api/cron/sync-tldv
 * Hourly cron job to sync tldv meetings from monitored emails
 */
export async function GET(request: Request) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get("authorization");
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const stats = {
      organizationsProcessed: 0,
      meetingsFound: 0,
      meetingsCreated: 0,
      errors: [] as string[],
    };

    // Get all monitored emails grouped by organization
    const { data: monitoredEmails, error: emailsError } = await supabaseAdmin
      .from("tldv_monitored_emails")
      .select("*");

    if (emailsError) {
      throw new Error(`Failed to fetch monitored emails: ${emailsError.message}`);
    }

    if (!monitoredEmails || monitoredEmails.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No monitored emails configured",
        stats,
      });
    }

    // Group by organization
    const emailsByOrg = monitoredEmails.reduce(
      (acc, email) => {
        const orgId = email.organization_id;
        if (!acc[orgId]) acc[orgId] = [];
        acc[orgId].push(email);
        return acc;
      },
      {} as Record<string, MonitoredEmail[]>
    );

    // Fetch all meetings from tldv API (shared across orgs)
    let allMeetings: TldvMeetingMetadata[];
    try {
      allMeetings = await fetchAllMeetings(10); // Max 10 pages
    } catch (error) {
      throw new Error(
        `Failed to fetch meetings from tldv: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }

    // Process each organization
    for (const [orgId, emails] of Object.entries(emailsByOrg) as [string, MonitoredEmail[]][]) {
      try {
        await processOrganization(orgId, emails, allMeetings, stats);
        stats.organizationsProcessed++;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        stats.errors.push(`Org ${orgId}: ${message}`);
        console.error(`Error processing org ${orgId}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("Cron sync-tldv error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

async function processOrganization(
  orgId: string,
  monitoredEmails: MonitoredEmail[],
  allMeetings: TldvMeetingMetadata[],
  stats: { meetingsFound: number; meetingsCreated: number; errors: string[] }
) {
  // Get already added meetings for this org
  const { data: existingMeetings } = await supabaseAdmin
    .from("tldv_meetings")
    .select("meeting_id")
    .eq("organization_id", orgId);

  const existingMeetingIds = new Set(
    existingMeetings?.map((m) => m.meeting_id) || []
  );

  // Also check inbox items to avoid duplicates in pending
  const { data: pendingItems } = await supabaseAdmin
    .from("inbox_items")
    .select("meeting_id")
    .eq("organization_id", orgId)
    .eq("type", "meeting")
    .not("meeting_id", "is", null);

  const pendingMeetingIds = new Set(
    pendingItems?.map((i) => i.meeting_id).filter(Boolean) || []
  );

  // Filter meetings by monitored emails
  const emailAddresses = monitoredEmails.map((e) => e.email);
  const matchingMeetings: TldvMeetingMetadata[] = [];

  for (const email of emailAddresses) {
    const filtered = filterMeetingsByEmail(allMeetings, email);
    for (const meeting of filtered) {
      // Avoid duplicates in matchingMeetings
      if (!matchingMeetings.find((m) => m.id === meeting.id)) {
        matchingMeetings.push(meeting);
      }
    }
  }

  stats.meetingsFound += matchingMeetings.length;

  // Process new meetings
  for (const meeting of matchingMeetings) {
    // Skip if already added or pending
    if (existingMeetingIds.has(meeting.id) || pendingMeetingIds.has(meeting.id)) {
      continue;
    }

    try {
      await createMeetingInboxItem(orgId, meeting, stats);
      stats.meetingsCreated++;

      // Add to pending set to avoid duplicates in this run
      pendingMeetingIds.add(meeting.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      stats.errors.push(`Meeting ${meeting.name}: ${message}`);
      console.error(`Error processing meeting ${meeting.id}:`, error);
    }

    // Delay between meetings to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

async function createMeetingInboxItem(
  orgId: string,
  meeting: TldvMeetingMetadata,
  stats: { errors: string[] }
) {
  // Fetch transcript
  let formattedTranscript = "";

  try {
    const transcript = await fetchTranscript(meeting.id);
    
    // Format transcript nicely with speaker names and timestamps
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

  // Get participants for metadata
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

  // Format duration
  const durationMins = Math.round(meeting.duration / 60);

  // Build summary with meeting info + transcript
  const summary = `**Date:** ${meetingDate}\n**Duration:** ${durationMins} minutes\n**Participants:** ${participants.join(", ")}\n\n---\n\n### Transcript\n\n${formattedTranscript}`;

  // Create inbox item
  const { error: insertError } = await supabaseAdmin.from("inbox_items").insert({
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

  if (insertError) {
    throw new Error(`Failed to create inbox item: ${insertError.message}`);
  }
}

/**
 * Format seconds into MM:SS timestamp
 */
function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

