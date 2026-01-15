import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export interface TldvMeetingResponse {
  id: string;
  meetingId: string;
  title: string;
  date: string;
  durationSeconds: number;
  chunkCount: number;
  tldvUrl: string;
  organizerName: string | null;
  organizerEmail: string | null;
  invitees: Array<{ name: string; email: string }>;
  createdAt: string;
}

/**
 * GET /api/tldv/meetings
 * List all tldv meetings for the organization
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

    const { data: meetings, error } = await supabaseAdmin
      .from("tldv_meetings")
      .select("*")
      .eq("organization_id", orgId)
      .order("meeting_date", { ascending: false });

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json(
        { error: "Failed to fetch meetings" },
        { status: 500 }
      );
    }

    const response: TldvMeetingResponse[] = meetings.map((meeting) => ({
      id: meeting.id,
      meetingId: meeting.meeting_id,
      title: meeting.meeting_title,
      date: meeting.meeting_date,
      durationSeconds: meeting.duration_seconds,
      chunkCount: meeting.chunk_count,
      tldvUrl: meeting.tldv_url,
      organizerName: meeting.organizer_name,
      organizerEmail: meeting.organizer_email,
      invitees: meeting.invitees || [],
      createdAt: meeting.created_at,
    }));

    return NextResponse.json({ meetings: response });
  } catch (error) {
    console.error("Error fetching tldv meetings:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

