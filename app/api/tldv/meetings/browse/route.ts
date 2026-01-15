import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  fetchAllMeetings,
  filterMeetingsByEmail,
  TldvMeetingMetadata,
} from "@/lib/tldv";

export interface BrowsableMeeting {
  id: string;
  name: string;
  happenedAt: string;
  duration: number;
  organizerEmail: string | null;
  organizerName: string | null;
  invitees: Array<{ name: string; email: string }>;
  url: string;
  isAlreadyAdded: boolean;
}

/**
 * GET /api/tldv/meetings/browse
 * Browse available meetings from tldv API, optionally filtered by attendee email
 * Returns meetings with a flag indicating if they're already added to the org
 */
export async function GET(request: Request) {
  try {
    const { orgId } = await auth();

    if (!orgId) {
      return NextResponse.json(
        { error: "Unauthorized - no organization selected" },
        { status: 401 }
      );
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);

    // Fetch all meetings from tldv API
    // We limit to 10 pages max to avoid long waits (500 meetings max)
    const allMeetings = await fetchAllMeetings(10);

    // Filter by email if provided
    const filteredMeetings = email
      ? filterMeetingsByEmail(allMeetings, email)
      : allMeetings;

    // Get list of meeting IDs already added to this org
    const { data: existingMeetings } = await supabaseAdmin
      .from("tldv_meetings")
      .select("meeting_id")
      .eq("organization_id", orgId);

    const existingMeetingIds = new Set(
      existingMeetings?.map((m) => m.meeting_id) || []
    );

    // Paginate results
    const totalMeetings = filteredMeetings.length;
    const totalPages = Math.ceil(totalMeetings / pageSize);
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedMeetings = filteredMeetings.slice(startIndex, endIndex);

    // Transform to response format
    const meetings: BrowsableMeeting[] = paginatedMeetings.map(
      (meeting: TldvMeetingMetadata) => ({
        id: meeting.id,
        name: meeting.name,
        happenedAt: meeting.happenedAt,
        duration: meeting.duration,
        organizerEmail: meeting.organizer?.email || null,
        organizerName: meeting.organizer?.name || null,
        invitees: meeting.invitees || [],
        url: meeting.url,
        isAlreadyAdded: existingMeetingIds.has(meeting.id),
      })
    );

    return NextResponse.json({
      meetings,
      pagination: {
        page,
        pageSize,
        totalPages,
        totalMeetings,
      },
      filter: {
        email: email || null,
      },
    });
  } catch (error) {
    console.error("Error browsing tldv meetings:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

